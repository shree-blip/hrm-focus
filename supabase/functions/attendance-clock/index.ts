import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Server-side attendance clock endpoint.
 * 
 * The server is the SINGLE SOURCE OF TRUTH for time.
 * Client devices NEVER supply timestamps or timezone info.
 * Employee timezone comes from the `employees.timezone` column.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnon = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get authenticated user
    const { data: { user }, error: userError } = await supabaseAnon.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action, work_mode, clock_type, location_name, client_timestamp } = body;

    // CONFLICT DETECTION: If client sends a timestamp, check drift but NEVER use it
    const serverNow = new Date();
    const serverUtc = serverNow.toISOString();

    if (client_timestamp) {
      const clientTime = new Date(client_timestamp);
      const driftMs = Math.abs(serverNow.getTime() - clientTime.getTime());
      if (driftMs > 60_000) {
        console.warn(
          `[TIMEZONE CONFLICT] user=${user.id} drift=${Math.round(driftMs / 1000)}s ` +
          `client=${client_timestamp} server=${serverUtc} — using server time`
        );
      }
    }

    // Fetch employee's profile timezone from DB (single source of truth)
    const { data: empData, error: empError } = await supabaseAdmin
      .from("employees")
      .select("id, timezone, first_name, last_name")
      .eq("profile_id", (
        await supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("user_id", user.id)
          .single()
      ).data?.id)
      .single();

    // Fallback: try direct profile lookup if the join fails
    let employeeTimezone = "Asia/Kathmandu"; // safe default
    let employeeId: string | null = null;

    if (empData) {
      employeeTimezone = empData.timezone || "Asia/Kathmandu";
      employeeId = empData.id;
    } else {
      // Try fetching via email match
      const { data: empByEmail } = await supabaseAdmin
        .from("employees")
        .select("id, timezone")
        .eq("email", user.email)
        .single();
      if (empByEmail) {
        employeeTimezone = empByEmail.timezone || "Asia/Kathmandu";
        employeeId = empByEmail.id;
      }
    }

    // Convert server UTC to employee's profile timezone for display
    const localTimeStr = serverNow.toLocaleString("en-US", {
      timeZone: employeeTimezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    // Get timezone abbreviation
    const tzAbbr = new Intl.DateTimeFormat("en-US", {
      timeZone: employeeTimezone,
      timeZoneName: "short",
    }).formatToParts(serverNow).find(p => p.type === "timeZoneName")?.value || employeeTimezone;

    let result: Record<string, unknown> = {};

    switch (action) {
      case "clock_in": {
        const { data, error } = await supabaseAdmin
          .from("attendance_logs")
          .insert({
            user_id: user.id,
            employee_id: employeeId,
            clock_in: serverUtc,
            clock_type: clock_type || "payroll",
            status: "active",
            location_name: location_name || "Office",
            work_mode: work_mode || "wfo",
          })
          .select()
          .single();

        if (error) throw error;

        // Create notification
        await supabaseAdmin.rpc("create_notification", {
          p_user_id: user.id,
          p_title: "⏰ Clocked In",
          p_message: `You clocked in at ${localTimeStr} ${tzAbbr} (${clock_type || "payroll"} time).`,
          p_type: "attendance",
          p_link: "/attendance",
        });

        result = {
          log: data,
          utc: serverUtc,
          local_time: localTimeStr,
          timezone: employeeTimezone,
          timezone_abbr: tzAbbr,
        };
        break;
      }

      case "clock_out": {
        const { log_id } = body;
        if (!log_id) throw new Error("log_id required for clock_out");

        // Get current log to finalize any active break/pause
        const { data: currentLog } = await supabaseAdmin
          .from("attendance_logs")
          .select("*")
          .eq("id", log_id)
          .single();

        if (!currentLog) throw new Error("Attendance log not found");

        const updatePayload: Record<string, unknown> = {
          clock_out: serverUtc,
          status: "completed",
        };

        // Finalize active pause
        if (currentLog.pause_start && !currentLog.pause_end) {
          const pauseStart = new Date(currentLog.pause_start);
          const additionalPause = Math.round((serverNow.getTime() - pauseStart.getTime()) / 60000);
          updatePayload.pause_end = serverUtc;
          updatePayload.total_pause_minutes = (currentLog.total_pause_minutes || 0) + additionalPause;
        }

        // Finalize active break
        if (currentLog.break_start && !currentLog.break_end) {
          const breakStart = new Date(currentLog.break_start);
          const additionalBreak = Math.round((serverNow.getTime() - breakStart.getTime()) / 60000);
          updatePayload.break_end = serverUtc;
          updatePayload.total_break_minutes = (currentLog.total_break_minutes || 0) + additionalBreak;
        }

        const { data, error } = await supabaseAdmin
          .from("attendance_logs")
          .update(updatePayload)
          .eq("id", log_id)
          .select()
          .single();

        if (error) throw error;

        // Auto-close active work logs
        const { data: activeLogs } = await supabaseAdmin
          .from("work_logs")
          .select("id, start_time, pause_start, total_pause_minutes, status")
          .eq("user_id", user.id)
          .is("end_time", null)
          .in("status", ["in_progress", "on_hold", "pending", "break", "paused"]);

        if (activeLogs && activeLogs.length > 0) {
          const clockOutHHMM = serverNow.toLocaleString("en-GB", {
            timeZone: "UTC",
            hour: "2-digit",
            minute: "2-digit",
          });
          for (const log of activeLogs) {
            let totalPause = log.total_pause_minutes || 0;
            if (log.pause_start && (log.status === "on_hold" || log.status === "paused")) {
              const pauseStart = new Date(log.pause_start);
              totalPause += Math.round((serverNow.getTime() - pauseStart.getTime()) / 60000);
            }
            let timeSpent = 0;
            if (log.start_time) {
              const [sH, sM] = log.start_time.split(":").map(Number);
              const [eH, eM] = clockOutHHMM.split(":").map(Number);
              const startMin = sH * 60 + sM;
              const endMin = eH * 60 + eM;
              const raw = endMin < startMin ? 24 * 60 - startMin + endMin : endMin - startMin;
              timeSpent = Math.max(0, raw - totalPause);
            }
            await supabaseAdmin
              .from("work_logs")
              .update({
                end_time: clockOutHHMM,
                status: "completed",
                total_pause_minutes: totalPause,
                pause_end: log.pause_start ? serverUtc : undefined,
                time_spent_minutes: timeSpent,
              })
              .eq("id", log.id);
          }
        }

        await supabaseAdmin.rpc("create_notification", {
          p_user_id: user.id,
          p_title: "⏰ Clocked Out",
          p_message: `You clocked out at ${localTimeStr} ${tzAbbr}. Your time has been recorded.`,
          p_type: "attendance",
          p_link: "/attendance",
        });

        result = {
          log: data,
          utc: serverUtc,
          local_time: localTimeStr,
          timezone: employeeTimezone,
          timezone_abbr: tzAbbr,
        };
        break;
      }

      case "start_break": {
        const { log_id } = body;
        if (!log_id) throw new Error("log_id required");

        const { data, error } = await supabaseAdmin
          .from("attendance_logs")
          .update({
            break_start: serverUtc,
            break_end: null,
            status: "break",
          })
          .eq("id", log_id)
          .select()
          .single();

        if (error) throw error;

        // Auto-pause active work log
        const { data: activeWorkLog } = await supabaseAdmin
          .from("work_logs")
          .select("id")
          .eq("user_id", user.id)
          .eq("status", "in_progress")
          .is("end_time", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (activeWorkLog) {
          await supabaseAdmin
            .from("work_logs")
            .update({ status: "on_hold", pause_start: serverUtc })
            .eq("id", activeWorkLog.id);
        }

        await supabaseAdmin.rpc("create_notification", {
          p_user_id: user.id,
          p_title: "☕ Break Started",
          p_message: `You started a break at ${localTimeStr} ${tzAbbr}.`,
          p_type: "attendance",
          p_link: "/attendance",
        });

        result = { log: data, utc: serverUtc, local_time: localTimeStr, timezone: employeeTimezone, timezone_abbr: tzAbbr };
        break;
      }

      case "end_break": {
        const { log_id } = body;
        if (!log_id) throw new Error("log_id required");

        const { data: currentLog } = await supabaseAdmin
          .from("attendance_logs")
          .select("break_start, total_break_minutes")
          .eq("id", log_id)
          .single();

        if (!currentLog?.break_start) throw new Error("No active break");

        const breakStart = new Date(currentLog.break_start);
        const breakMinutes = Math.round((serverNow.getTime() - breakStart.getTime()) / 60000);

        const { data, error } = await supabaseAdmin
          .from("attendance_logs")
          .update({
            break_end: serverUtc,
            total_break_minutes: (currentLog.total_break_minutes || 0) + breakMinutes,
            status: "active",
          })
          .eq("id", log_id)
          .select()
          .single();

        if (error) throw error;

        // Auto-resume work log
        const { data: pausedLog } = await supabaseAdmin
          .from("work_logs")
          .select("id, pause_start, total_pause_minutes")
          .eq("user_id", user.id)
          .eq("status", "on_hold")
          .is("end_time", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (pausedLog) {
          let totalPause = pausedLog.total_pause_minutes || 0;
          if (pausedLog.pause_start) {
            totalPause += Math.round((serverNow.getTime() - new Date(pausedLog.pause_start).getTime()) / 60000);
          }
          await supabaseAdmin
            .from("work_logs")
            .update({ status: "in_progress", pause_end: serverUtc, total_pause_minutes: totalPause })
            .eq("id", pausedLog.id);
        }

        await supabaseAdmin.rpc("create_notification", {
          p_user_id: user.id,
          p_title: "💼 Break Ended",
          p_message: `You resumed work after a ${breakMinutes} minute break.`,
          p_type: "attendance",
          p_link: "/attendance",
        });

        result = { log: data, utc: serverUtc, local_time: localTimeStr, timezone: employeeTimezone, timezone_abbr: tzAbbr, break_minutes: breakMinutes };
        break;
      }

      case "start_pause": {
        const { log_id } = body;
        if (!log_id) throw new Error("log_id required");

        const { data, error } = await supabaseAdmin
          .from("attendance_logs")
          .update({
            pause_start: serverUtc,
            pause_end: null,
            status: "paused",
          })
          .eq("id", log_id)
          .select()
          .single();

        if (error) throw error;

        // Auto-pause active work log
        const { data: activeWorkLog } = await supabaseAdmin
          .from("work_logs")
          .select("id")
          .eq("user_id", user.id)
          .eq("status", "in_progress")
          .is("end_time", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (activeWorkLog) {
          await supabaseAdmin
            .from("work_logs")
            .update({ status: "on_hold", pause_start: serverUtc })
            .eq("id", activeWorkLog.id);
        }

        await supabaseAdmin.rpc("create_notification", {
          p_user_id: user.id,
          p_title: "⏸️ Clock Paused",
          p_message: `You paused your clock at ${localTimeStr} ${tzAbbr}.`,
          p_type: "attendance",
          p_link: "/attendance",
        });

        result = { log: data, utc: serverUtc, local_time: localTimeStr, timezone: employeeTimezone, timezone_abbr: tzAbbr };
        break;
      }

      case "end_pause": {
        const { log_id, new_work_mode } = body;
        if (!log_id) throw new Error("log_id required");

        const { data: currentLog } = await supabaseAdmin
          .from("attendance_logs")
          .select("pause_start, total_pause_minutes")
          .eq("id", log_id)
          .single();

        if (!currentLog?.pause_start) throw new Error("No active pause");

        const pauseStart = new Date(currentLog.pause_start);
        const pauseMinutes = Math.round((serverNow.getTime() - pauseStart.getTime()) / 60000);

        const updatePayload: Record<string, unknown> = {
          pause_end: serverUtc,
          total_pause_minutes: (currentLog.total_pause_minutes || 0) + pauseMinutes,
          status: "active",
        };
        if (new_work_mode) updatePayload.work_mode = new_work_mode;

        const { data, error } = await supabaseAdmin
          .from("attendance_logs")
          .update(updatePayload)
          .eq("id", log_id)
          .select()
          .single();

        if (error) throw error;

        // Auto-resume work log
        const { data: pausedLog } = await supabaseAdmin
          .from("work_logs")
          .select("id, pause_start, total_pause_minutes")
          .eq("user_id", user.id)
          .eq("status", "on_hold")
          .is("end_time", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (pausedLog) {
          let totalPause = pausedLog.total_pause_minutes || 0;
          if (pausedLog.pause_start) {
            totalPause += Math.round((serverNow.getTime() - new Date(pausedLog.pause_start).getTime()) / 60000);
          }
          await supabaseAdmin
            .from("work_logs")
            .update({ status: "in_progress", pause_end: serverUtc, total_pause_minutes: totalPause })
            .eq("id", pausedLog.id);
        }

        await supabaseAdmin.rpc("create_notification", {
          p_user_id: user.id,
          p_title: "▶️ Clock Resumed",
          p_message: `You resumed work after a ${pauseMinutes} minute pause.${new_work_mode === "wfh" ? " Now working from home." : new_work_mode === "wfo" ? " Now working from office." : ""}`,
          p_type: "attendance",
          p_link: "/attendance",
        });

        result = { log: data, utc: serverUtc, local_time: localTimeStr, timezone: employeeTimezone, timezone_abbr: tzAbbr, pause_minutes: pauseMinutes };
        break;
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[attendance-clock] Error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
