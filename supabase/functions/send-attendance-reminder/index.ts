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

    // Widen the query window to catch users who may have taken breaks/pauses
    // Get all users who clocked in 6-10 hours ago (wide window)
    const wideStartTime = new Date(now.getTime() - 10 * 60 * 60 * 1000); // 10 hours ago
    const wideEndTime = new Date(now.getTime() - 6 * 60 * 60 * 1000);   // 6 hours ago

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
      .gte("clock_in", wideStartTime.toISOString())
      .lte("clock_in", wideEndTime.toISOString());

    if (fetchError) {
      console.error("Error fetching active logs:", fetchError);
      throw fetchError;
    }

    console.log(`Found ${activeLogs?.length || 0} users in wide time window, filtering for 7h50m net work`);

    const results: Array<{ user_id: string; email_sent: boolean; net_hours: number; error?: string }> = [];

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

      if (!employee?.email) {
        console.log(`No email found for user ${log.user_id}, skipping`);
        continue;
      }

      // Calculate actual worked hours and minutes for display
      const netWorkHours = Math.floor(netWorkMinutes / 60);
      const netWorkMins = Math.round(netWorkMinutes % 60);
      
      // Calculate when they'll hit exactly 8 hours
      const remainingMinutes = 480 - netWorkMinutes; // 8 hours = 480 minutes
      const eightHourMark = new Date(now.getTime() + remainingMinutes * 60 * 1000);

      console.log(`Sending reminder to ${employee.email} - worked ${netWorkHours}h ${netWorkMins}m, 8hrs at ${eightHourMark.toLocaleTimeString()}`);

      // Create in-app notification
      await supabase.rpc("create_notification", {
        p_user_id: log.user_id,
        p_title: "⏰ 8-Hour Work Reminder",
        p_message: `You've been working for ${netWorkHours}h ${netWorkMins}m. Your 8 hours will be reached in ${Math.round(remainingMinutes)} minutes!`,
        p_type: "attendance",
        p_link: "/attendance",
      });

      // Send email
      let emailSent = false;
      if (RESEND_API_KEY) {
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
              net_work_hours: netWorkHours,
              net_work_minutes: netWorkMins,
              eight_hour_mark: eightHourMark.toISOString(),
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
              subject: "⏰ Time Reminder - Your 8 hours is almost up!",
              html: buildReminderEmail(
                employee.first_name,
                employee.last_name,
                new Date(log.clock_in),
                netWorkHours,
                netWorkMins,
                eightHourMark,
                Math.round(remainingMinutes)
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
        net_hours: parseFloat((netWorkMinutes / 60).toFixed(2)),
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
  clockInTime: Date,
  hoursWorked: number,
  minutesWorked: number,
  eightHourMark: Date,
  remainingMinutes: number
): string {
  const timeWorked = hoursWorked > 0 
    ? `${hoursWorked} hour${hoursWorked !== 1 ? 's' : ''} and ${minutesWorked} minute${minutesWorked !== 1 ? 's' : ''}` 
    : `${minutesWorked} minute${minutesWorked !== 1 ? 's' : ''}`;

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family:Arial,sans-serif;background:#f4f5f7;padding:20px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <h2 style="color:#d97706;margin-top:0;">⏰ Time to Clock Out Soon!</h2>
    <p>Hi ${firstName},</p>
    <p>You have been logged in for <strong>${timeWorked}</strong> and your 8 hours is going to reach in <strong>${remainingMinutes} minutes</strong>. Make sure to clock out on time!</p>
    
    <div style="background:#fef3c7;border-left:4px solid #d97706;padding:16px;margin:20px 0;border-radius:4px;">
      <p style="margin:0;color:#92400e;"><strong>⚠️ Important:</strong> Your 8-hour workday will end at <strong style="color:#d97706;">${eightHourMark.toLocaleTimeString('en-US', { 
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })}</strong></p>
    </div>

    <table style="width:100%;border-collapse:collapse;margin:20px 0;">
      <tr style="border-bottom:1px solid #e5e7eb;">
        <td style="padding:12px 0;color:#666;">Clocked In At:</td>
        <td style="padding:12px 0;font-weight:600;">${clockInTime.toLocaleString("en-US", { 
          weekday: 'short',
          hour: 'numeric', 
          minute: '2-digit',
          hour12: true
        })}</td>
      </tr>
      <tr style="border-bottom:1px solid #e5e7eb;">
        <td style="padding:12px 0;color:#666;">Time Worked:</td>
        <td style="padding:12px 0;font-weight:600;color:#059669;">${timeWorked}</td>
      </tr>
      <tr>
        <td style="padding:12px 0;color:#666;">8-Hour Mark:</td>
        <td style="padding:12px 0;font-weight:600;color:#d97706;">${eightHourMark.toLocaleTimeString('en-US', { 
          hour: 'numeric',
          minute: '2-digit', 
          hour12: true
        })}</td>
      </tr>
    </table>
    
    <p style="color:#666;margin:20px 0;">Please remember to clock out on time to keep your attendance records accurate and maintain work-life balance.</p>
    
    <a href="https://hrm-focus.lovable.app/attendance" style="display:inline-block;background:#d97706;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;margin:20px 0;font-weight:600;">Clock Out Now</a>
    
    <p style="color:#16a34a;font-weight:600;margin:20px 0;">Happy working! 😊</p>
    
    <div style="text-align:center;padding-top:20px;border-top:1px solid #e5e7eb;color:#999;font-size:12px;">
      <p style="margin:0;">This is an automated reminder from Focus Your Finance HRM System</p>
    </div>
  </div>
</body>
</html>`;
}