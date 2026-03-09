import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const now = new Date();

    // Find users who clocked in ~7h50m ago (between 7h45m and 7h55m to avoid duplicates)
    // and haven't clocked out yet
    const minThreshold = new Date(now.getTime() - (7 * 60 + 55) * 60 * 1000); // 7h55m ago
    const maxThreshold = new Date(now.getTime() - (7 * 60 + 45) * 60 * 1000); // 7h45m ago

    const { data: activeLogs, error: fetchError } = await supabase
      .from("attendance_logs")
      .select(`
        id,
        user_id,
        employee_id,
        clock_in,
        total_break_minutes,
        total_pause_minutes,
        status,
        employees!attendance_logs_employee_id_fkey (
          first_name,
          last_name,
          email
        )
      `)
      .is("clock_out", null)
      .neq("status", "auto_clocked_out")
      .gte("clock_in", minThreshold.toISOString())
      .lte("clock_in", maxThreshold.toISOString());

    if (fetchError) {
      console.error("Error fetching active logs:", fetchError);
      throw fetchError;
    }

    console.log(`Found ${activeLogs?.length || 0} users approaching 8 hours`);

    const results: Array<{ user_id: string; email_sent: boolean; error?: string }> = [];

    for (const log of activeLogs || []) {
      // Calculate net work time accounting for breaks/pauses
      const clockInTime = new Date(log.clock_in).getTime();
      const breakMs = (log.total_break_minutes || 0) * 60 * 1000;
      const pauseMs = (log.total_pause_minutes || 0) * 60 * 1000;
      const netWorkMs = now.getTime() - clockInTime - breakMs - pauseMs;
      const netWorkMinutes = netWorkMs / (60 * 1000);

      // Only send if net work is between 465-475 minutes (7h45m - 7h55m)
      if (netWorkMinutes < 465 || netWorkMinutes > 475) {
        continue;
      }

      // Skip if on break or paused
      if (log.status === "break" || log.status === "paused") {
        continue;
      }

      // Check if we already sent a reminder for this log today
      const { data: existingReminder } = await supabase
        .from("notification_logs")
        .select("id")
        .eq("event_type", "attendance_8hr_reminder")
        .eq("recipient_user_id", log.user_id)
        .gte("created_at", new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString())
        .limit(1);

      if (existingReminder && existingReminder.length > 0) {
        console.log(`Reminder already sent to user ${log.user_id} today, skipping`);
        continue;
      }

      // Get employee info
      const employeeData = log.employees as unknown;
      let employee: { first_name: string; last_name: string; email: string } | null = null;

      if (Array.isArray(employeeData) && employeeData.length > 0) {
        employee = employeeData[0] as typeof employee;
      } else if (employeeData && typeof employeeData === "object" && employeeData !== null) {
        const empObj = employeeData as Record<string, unknown>;
        if ("email" in empObj && "first_name" in empObj) {
          employee = {
            first_name: String(empObj.first_name),
            last_name: String(empObj.last_name),
            email: String(empObj.email),
          };
        }
      }

      // Create in-app notification
      await supabase.rpc("create_notification", {
        p_user_id: log.user_id,
        p_title: "⏰ 8-Hour Work Reminder",
        p_message:
          "You've been working for nearly 8 hours. Don't forget to clock out in the next 10 minutes!",
        p_type: "attendance",
        p_link: "/attendance",
      });

      // Send email
      let emailSent = false;
      if (RESEND_API_KEY && employee?.email) {
        const clockInDate = new Date(log.clock_in);
        const expectedClockOut = new Date(clockInDate.getTime() + 8 * 60 * 60 * 1000);

        // Log the attempt
        const { data: logEntry } = await supabase
          .from("notification_logs")
          .insert({
            recipient_email: employee.email,
            recipient_user_id: log.user_id,
            notification_type: "email",
            event_type: "attendance_8hr_reminder",
            payload: {
              employee_name: `${employee.first_name} ${employee.last_name}`,
              clock_in: log.clock_in,
              expected_clock_out: expectedClockOut.toISOString(),
            },
            status: "pending",
            attempts: 0,
            next_retry_at: new Date().toISOString(),
          })
          .select()
          .single();

        try {
          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${RESEND_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: "HRM Focus <noreply@notifications.focusyourfinance.com>",
              to: [employee.email],
              subject: "⏰ 8-Hour Work Reminder - Don't Forget to Clock Out!",
              html: buildReminderEmail(
                employee.first_name,
                employee.last_name,
                clockInDate,
                expectedClockOut
              ),
            }),
          });

          if (!res.ok) {
            const body = await res.text();
            throw new Error(`Resend API error ${res.status}: ${body}`);
          }

          if (logEntry) {
            await supabase
              .from("notification_logs")
              .update({
                status: "sent",
                attempts: 1,
                last_attempt_at: new Date().toISOString(),
                next_retry_at: null,
                updated_at: new Date().toISOString(),
              })
              .eq("id", logEntry.id);
          }

          emailSent = true;
          console.log(`Reminder email sent to ${employee.email}`);
        } catch (emailErr) {
          const errMsg = emailErr instanceof Error ? emailErr.message : String(emailErr);
          console.error(`Failed to send reminder to ${employee.email}:`, errMsg);

          if (logEntry) {
            await supabase
              .from("notification_logs")
              .update({
                status: "failed",
                attempts: 1,
                last_attempt_at: new Date().toISOString(),
                error_message: errMsg,
                updated_at: new Date().toISOString(),
              })
              .eq("id", logEntry.id);
          }
        }
      }

      results.push({
        user_id: log.user_id,
        email_sent: emailSent,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        reminders_sent: results.length,
        results,
        timestamp: now.toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("send-attendance-reminder error:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function buildReminderEmail(
  firstName: string,
  lastName: string,
  clockIn: Date,
  expectedClockOut: Date
): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family:Arial,sans-serif;background:#f4f5f7;padding:20px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <h2 style="color:#d97706;margin-top:0;">⏰ 8-Hour Work Reminder</h2>
    <p>Hi ${firstName} ${lastName},</p>
    <p>You've been working for nearly <strong>8 hours</strong>. Don't forget to clock out soon!</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <tr><td style="padding:8px 0;color:#666;width:160px;">Clocked In At</td><td style="padding:8px 0;font-weight:600;">${clockIn.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</td></tr>
      <tr><td style="padding:8px 0;color:#666;">Expected Clock Out</td><td style="padding:8px 0;font-weight:600;color:#d97706;">${expectedClockOut.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</td></tr>
    </table>
    <p style="color:#666;">If you've already clocked out, you can ignore this email. Otherwise, please remember to clock out to keep your attendance records accurate.</p>
    <a href="https://hrm-focus.lovable.app/attendance" style="display:inline-block;background:#d97706;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;margin-top:8px;">Go to Attendance</a>
    <div style="text-align:center;padding-top:20px;color:#999;font-size:12px;">
      <p>This is an automated reminder from Focus Your Finance HRM System</p>
    </div>
  </div>
</body>
</html>`;
}
