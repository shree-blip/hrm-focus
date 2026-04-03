import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FIXED_CC_EMAIL = "hello@focusyourfinance.com";

interface AttendanceEditPayload {
  editor_name: string;
  editor_email: string;
  employee_name: string;
  edit_date: string;
  change_summary: string;
  reason: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const anonClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const payload: AttendanceEditPayload = await req.json();

    const { editor_name, editor_email, employee_name, edit_date, change_summary, reason } = payload;

    // Get all VP/Admin users to notify
    const { data: vpUsers } = await supabase.from("user_roles").select("user_id").in("role", ["vp", "admin"]);

    if (!vpUsers || vpUsers.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No VP/Admin users to notify" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get VP emails from profiles
    const vpUserIds = vpUsers.map((v) => v.user_id);
    const { data: vpProfiles } = await supabase
      .from("profiles")
      .select("user_id, email, first_name, last_name")
      .in("user_id", vpUserIds);

    const vpEmails = vpProfiles?.map((p) => p.email).filter(Boolean) || [];
    const allEmails = [...new Set([...vpEmails, FIXED_CC_EMAIL])];

    const emailSubject = `⚠️ Attendance Edited: ${employee_name} by ${editor_name}`;
    const emailHtml = buildAttendanceEditEmail(
      editor_name,
      editor_email,
      employee_name,
      edit_date,
      change_summary,
      reason,
    );

    const results: Array<{ target: string; success: boolean; error?: string }> = [];

    for (const email of allEmails) {
      // Create notification log
      const { data: logEntry, error: logError } = await supabase
        .from("notification_logs")
        .insert({
          recipient_email: email,
          notification_type: "email",
          event_type: "attendance_edit",
          payload: { editor_name, editor_email, employee_name, edit_date, change_summary, reason },
          status: "pending",
          attempts: 0,
          next_retry_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (logError) {
        console.error("Failed to create notification log:", logError);
        results.push({ target: email, success: false, error: String(logError) });
        continue;
      }

      // Send email
      const emailResult = await sendEmail(supabase, logEntry.id, email, emailSubject, emailHtml);
      results.push({ target: email, ...emailResult });
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("send-attendance-edit-notification error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function sendEmail(
  supabase: any,
  logId: string,
  to: string,
  subject: string,
  html: string,
  attempt = 1,
): Promise<{ success: boolean; error?: string }> {
  if (!RESEND_API_KEY) {
    await supabase
      .from("notification_logs")
      .update({
        status: "skipped",
        error_message: "RESEND_API_KEY not configured",
        updated_at: new Date().toISOString(),
      })
      .eq("id", logId);
    return { success: false, error: "RESEND_API_KEY not configured" };
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
        to: [to],
        subject,
        html,
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
        attempts: attempt,
        last_attempt_at: new Date().toISOString(),
        next_retry_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", logId);

    return { success: true };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`Email attempt ${attempt} to ${to} failed:`, errorMsg);

    await supabase
      .from("notification_logs")
      .update({
        status: attempt >= 3 ? "failed" : "pending",
        attempts: attempt,
        last_attempt_at: new Date().toISOString(),
        next_retry_at: attempt < 3 ? new Date(Date.now() + 2 * 60 * 1000).toISOString() : null,
        error_message: errorMsg,
        updated_at: new Date().toISOString(),
      })
      .eq("id", logId);

    if (attempt >= 3) {
      const { data: admins } = await supabase.from("user_roles").select("user_id").in("role", ["vp", "admin"]);

      for (const admin of admins || []) {
        await supabase.rpc("create_notification", {
          p_user_id: admin.user_id,
          p_title: "⚠️ Email Delivery Failed",
          p_message: `Failed to deliver attendance edit email to ${to} after 3 attempts. Error: ${errorMsg}`,
          p_type: "warning",
          p_link: "/notifications",
        });
      }
    }

    return { success: false, error: errorMsg };
  }
}

function buildAttendanceEditEmail(
  editorName: string,
  editorEmail: string,
  employeeName: string,
  editDate: string,
  changeSummary: string,
  reason: string,
): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family:Arial,sans-serif;background:#f4f5f7;padding:20px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <h2 style="color:#d97706;margin-top:0;">⚠️ Attendance Record Edited</h2>
    <p style="color:#333;">An attendance record has been modified by a manager. Please review the details below:</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <tr><td style="padding:8px 0;color:#666;width:140px;">Edited By</td><td style="padding:8px 0;font-weight:600;">${editorName}</td></tr>
      <tr><td style="padding:8px 0;color:#666;">Editor Email</td><td style="padding:8px 0;">${editorEmail}</td></tr>
      <tr><td style="padding:8px 0;color:#666;">Employee</td><td style="padding:8px 0;font-weight:600;">${employeeName}</td></tr>
      <tr><td style="padding:8px 0;color:#666;">Date</td><td style="padding:8px 0;">${editDate}</td></tr>
      <tr><td style="padding:8px 0;color:#666;">Changes</td><td style="padding:8px 0;">${changeSummary}</td></tr>
      <tr><td style="padding:8px 0;color:#666;">Reason</td><td style="padding:8px 0;font-style:italic;">${reason}</td></tr>
    </table>
    <a href="https://hrm-focus.lovable.app/reports" style="display:inline-block;background:#1a1a2e;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;margin-top:8px;">View Reports</a>
    <p style="color:#999;font-size:12px;margin-top:24px;">This is an automated notification from HRM Focus.</p>
  </div>
</body>
</html>`;
}
