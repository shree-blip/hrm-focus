import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Reminder window based on NET worked minutes
const REMINDER_MIN_MINUTES = 470; // 7h 50m
const REMINDER_MAX_MINUTES = 480; // before 8h exactly

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const now = new Date();

    // Fetch all active logs instead of filtering by raw clock_in window
    const { data: activeLogs, error: fetchError } = await supabase
      .from("attendance_logs")
      .select(
        `
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
      `,
      )
      .is("clock_out", null)
      .neq("status", "auto_clocked_out");

    if (fetchError) {
      console.error("Error fetching active logs:", fetchError);
      throw fetchError;
    }

    console.log(`Found ${activeLogs?.length || 0} active users to evaluate`);

    const results: Array<{
      user_id: string;
      attendance_log_id: string;
      email_sent: boolean;
      skipped_reason?: string;
      net_work_minutes?: number;
      error?: string;
    }> = [];

    for (const log of activeLogs || []) {
      const clockInTime = new Date(log.clock_in).getTime();
      const breakMs = (log.total_break_minutes || 0) * 60 * 1000;
      const pauseMs = (log.total_pause_minutes || 0) * 60 * 1000;
      const netWorkMs = now.getTime() - clockInTime - breakMs - pauseMs;
      const netWorkMinutes = Math.floor(netWorkMs / (60 * 1000));

      // Skip if not yet in reminder window
      if (netWorkMinutes < REMINDER_MIN_MINUTES || netWorkMinutes >= REMINDER_MAX_MINUTES) {
        results.push({
          user_id: log.user_id,
          attendance_log_id: log.id,
          email_sent: false,
          skipped_reason: "Not in reminder window",
          net_work_minutes: netWorkMinutes,
        });
        continue;
      }

      // Skip if currently on break or paused
      if (log.status === "break" || log.status === "paused") {
        results.push({
          user_id: log.user_id,
          attendance_log_id: log.id,
          email_sent: false,
          skipped_reason: `Currently ${log.status}`,
          net_work_minutes: netWorkMinutes,
        });
        continue;
      }

      // Check if reminder already sent for THIS attendance log
      const { data: existingReminder, error: reminderCheckError } = await supabase
        .from("notification_logs")
        .select("id")
        .eq("event_type", "attendance_8hr_reminder")
        .eq("recipient_user_id", log.user_id)
        .contains("payload", { attendance_log_id: log.id })
        .limit(1);

      if (reminderCheckError) {
        console.error(`Failed checking existing reminder for log ${log.id}:`, reminderCheckError);
      }

      if (existingReminder && existingReminder.length > 0) {
        console.log(`Reminder already sent for attendance log ${log.id}, skipping`);
        results.push({
          user_id: log.user_id,
          attendance_log_id: log.id,
          email_sent: false,
          skipped_reason: "Reminder already sent for this attendance log",
          net_work_minutes: netWorkMinutes,
        });
        continue;
      }

      // Get employee info safely
      const employeeData = log.employees as unknown;
      let employee: { first_name: string; last_name: string; email: string } | null = null;

      if (Array.isArray(employeeData) && employeeData.length > 0) {
        employee = employeeData[0] as typeof employee;
      } else if (employeeData && typeof employeeData === "object" && employeeData !== null) {
        const empObj = employeeData as Record<string, unknown>;
        if ("email" in empObj && "first_name" in empObj) {
          employee = {
            first_name: String(empObj.first_name),
            last_name: String(empObj.last_name || ""),
            email: String(empObj.email),
          };
        }
      }

      // Create in-app notification
      await supabase.rpc("create_notification", {
        p_user_id: log.user_id,
        p_title: "⏰ 8-Hour Work Reminder",
        p_message: "You've been working for nearly 8 hours. Don't forget to clock out in the next 10 minutes!",
        p_type: "attendance",
        p_link: "/attendance",
      });

      // Send email to employee only
      let emailSent = false;

      if (RESEND_API_KEY && employee?.email) {
        const clockInDate = new Date(log.clock_in);

        // Expected clock-out based on NET 8-hour target:
        // clock_in + breaks + pauses + 8 hours work target
        const expectedClockOut = new Date(clockInDate.getTime() + breakMs + pauseMs + 8 * 60 * 60 * 1000);

        // Log the attempt
        const { data: logEntry, error: logInsertError } = await supabase
          .from("notification_logs")
          .insert({
            recipient_email: employee.email,
            recipient_user_id: log.user_id,
            notification_type: "email",
            event_type: "attendance_8hr_reminder",
            payload: {
              attendance_log_id: log.id,
              employee_name: `${employee.first_name} ${employee.last_name}`.trim(),
              clock_in: log.clock_in,
              expected_clock_out: expectedClockOut.toISOString(),
              total_break_minutes: log.total_break_minutes || 0,
              total_pause_minutes: log.total_pause_minutes || 0,
              net_work_minutes: netWorkMinutes,
            },
            status: "pending",
            attempts: 0,
            next_retry_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (logInsertError) {
          console.error("Failed to create notification log:", logInsertError);
          results.push({
            user_id: log.user_id,
            attendance_log_id: log.id,
            email_sent: false,
            net_work_minutes: netWorkMinutes,
            error: String(logInsertError),
          });
          continue;
        }

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
                expectedClockOut,
                netWorkMinutes,
              ),
            }),
          });

          if (!res.ok) {
            const body = await res.text();
            throw new Error(`Resend API error ${res.status}: ${body}`);
          }

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

          emailSent = true;
          console.log(`Reminder email sent to ${employee.email} for log ${log.id}`);
        } catch (emailErr) {
          const errMsg = emailErr instanceof Error ? emailErr.message : String(emailErr);
          console.error(`Failed to send reminder to ${employee.email}:`, errMsg);

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

          results.push({
            user_id: log.user_id,
            attendance_log_id: log.id,
            email_sent: false,
            net_work_minutes: netWorkMinutes,
            error: errMsg,
          });
          continue;
        }
      } else {
        results.push({
          user_id: log.user_id,
          attendance_log_id: log.id,
          email_sent: false,
          skipped_reason: !RESEND_API_KEY ? "RESEND_API_KEY not configured" : "Employee email not found",
          net_work_minutes: netWorkMinutes,
        });
        continue;
      }

      results.push({
        user_id: log.user_id,
        attendance_log_id: log.id,
        email_sent: emailSent,
        net_work_minutes: netWorkMinutes,
      });
    }

    const sentCount = results.filter((r) => r.email_sent).length;

    return new Response(
      JSON.stringify({
        success: true,
        reminders_sent: sentCount,
        evaluated_logs: activeLogs?.length || 0,
        results,
        timestamp: now.toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("send-attendance-reminder error:", errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function buildReminderEmail(
  firstName: string,
  lastName: string,
  clockIn: Date,
  expectedClockOut: Date,
  netWorkMinutes: number,
): string {
  const workedHours = Math.floor(netWorkMinutes / 60);
  const workedMinutes = netWorkMinutes % 60;

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family:Arial,sans-serif;background:#f4f5f7;padding:20px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <h2 style="color:#d97706;margin-top:0;">⏰ 8-Hour Work Reminder</h2>
    <p>Hi ${firstName} ${lastName},</p>
    <p>You've worked nearly <strong>8 hours</strong> today. Please remember to clock out soon.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <tr>
        <td style="padding:8px 0;color:#666;width:180px;">Clocked In At</td>
        <td style="padding:8px 0;font-weight:600;">
          ${clockIn.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
        </td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#666;">Net Worked Time</td>
        <td style="padding:8px 0;font-weight:600;">
          ${workedHours}h ${workedMinutes}m
        </td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#666;">Expected Clock Out</td>
        <td style="padding:8px 0;font-weight:600;color:#d97706;">
          ${expectedClockOut.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
        </td>
      </tr>
    </table>
    <p style="color:#666;">
      If you've already clocked out, you can ignore this email. Otherwise, please clock out to keep your attendance records accurate.
    </p>
    <a href="https://hrm-focus.lovable.app/attendance" style="display:inline-block;background:#d97706;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;margin-top:8px;">Go to Attendance</a>
    <div style="text-align:center;padding-top:20px;color:#999;font-size:12px;">
      <p>This is an automated reminder from Focus Your Finance HRM System</p>
    </div>
  </div>
</body>
</html>`;
}
