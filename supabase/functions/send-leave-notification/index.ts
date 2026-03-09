import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FIXED_CC_EMAIL = "hello@focusyourfinance.com";

interface LeaveNotificationPayload {
  leave_request_id: string;
  event_type: "submitted" | "approved" | "rejected";
  employee_name: string;
  employee_email?: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  days: number;
  reason?: string;
  rejection_reason?: string;
  approver_name?: string;
  target_user_ids: string[];
  target_emails?: string[];
  requesting_user_id: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const payload: LeaveNotificationPayload = await req.json();

    const {
      leave_request_id,
      event_type,
      employee_name,
      leave_type,
      start_date,
      end_date,
      days,
      reason,
      rejection_reason,
      approver_name,
      target_user_ids,
      target_emails = [],
      requesting_user_id,
    } = payload;

    // Build notification content based on event type
    let title: string;
    let message: string;
    let emailSubject: string;
    let emailHtml: string;

    const dateRange = `${start_date} to ${end_date}`;

    if (event_type === "submitted") {
      title = `📋 New Leave Request from ${employee_name}`;
      message = `${employee_name} submitted a ${leave_type} request for ${days} day(s) (${dateRange}).${reason ? ` Reason: ${reason}` : ""}`;
      emailSubject = `Leave Request: ${employee_name} - ${leave_type} (${days} days)`;
      emailHtml = buildSubmittedEmail(employee_name, leave_type, start_date, end_date, days, reason);
    } else if (event_type === "approved") {
      title = `✅ Leave Request Approved`;
      message = `Your ${leave_type} request for ${days} day(s) (${dateRange}) has been approved by ${approver_name || "Manager"}.`;
      emailSubject = `Leave Approved: ${leave_type} (${days} days)`;
      emailHtml = buildApprovedEmail(employee_name, leave_type, start_date, end_date, days, approver_name || "Manager");
    } else if (event_type === "rejected") {
      title = `❌ Leave Request Rejected`;
      message = `Your ${leave_type} request for ${days} day(s) (${dateRange}) has been rejected by ${approver_name || "Manager"}.${rejection_reason ? ` Reason: ${rejection_reason}` : ""}`;
      emailSubject = `Leave Rejected: ${leave_type} (${days} days)`;
      emailHtml = buildRejectedEmail(employee_name, leave_type, start_date, end_date, days, approver_name || "Manager", rejection_reason);
    } else {
      return new Response(JSON.stringify({ error: "Invalid event_type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: Array<{ type: string; target: string; success: boolean; error?: string }> = [];

    // 1. Create in-app notifications for target users
    for (const userId of target_user_ids) {
      try {
        const { error } = await supabase.rpc("create_notification", {
          p_user_id: userId,
          p_title: title,
          p_message: message,
          p_type: "leave",
          p_link: event_type === "submitted" ? "/approvals" : "/leave",
        });
        if (error) throw error;
        results.push({ type: "in_app", target: userId, success: true });
      } catch (err) {
        console.error(`Failed to create notification for ${userId}:`, err);
        results.push({ type: "in_app", target: userId, success: false, error: String(err) });
      }
    }

    // 2. Send emails via Resend
    const allEmails = [...new Set([...target_emails, FIXED_CC_EMAIL])];

    for (const email of allEmails) {
      const logEntry = await createNotificationLog(supabase, {
        recipient_email: email,
        event_type,
        payload: { leave_request_id, employee_name, leave_type, start_date, end_date, days },
        status: "pending",
      });

      const emailResult = await sendEmailWithRetry(
        supabase,
        logEntry.id,
        email,
        emailSubject,
        emailHtml
      );

      results.push({
        type: "email",
        target: email,
        success: emailResult.success,
        error: emailResult.error,
      });
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("send-leave-notification error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function createNotificationLog(
  supabase: ReturnType<typeof createClient>,
  data: {
    recipient_email: string;
    event_type: string;
    payload: Record<string, unknown>;
    status: string;
    notification_id?: string;
    recipient_user_id?: string;
  }
) {
  const { data: log, error } = await supabase
    .from("notification_logs")
    .insert({
      recipient_email: data.recipient_email,
      recipient_user_id: data.recipient_user_id || null,
      notification_type: "email",
      event_type: data.event_type,
      payload: data.payload,
      status: data.status,
      notification_id: data.notification_id || null,
      attempts: 0,
      next_retry_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error("Failed to create notification log:", error);
    throw error;
  }
  return log;
}

async function sendEmailWithRetry(
  supabase: ReturnType<typeof createClient>,
  logId: string,
  to: string,
  subject: string,
  html: string,
  attempt = 1
): Promise<{ success: boolean; error?: string }> {
  if (!RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not set, skipping email");
    await supabase
      .from("notification_logs")
      .update({ status: "skipped", error_message: "RESEND_API_KEY not configured", updated_at: new Date().toISOString() })
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
        from: "HRM Focus <noreply@focusyourfinance.com>",
        to: [to],
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Resend API error ${res.status}: ${body}`);
    }

    // Mark as sent
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

    const nextRetry = attempt < 3
      ? new Date(Date.now() + 2 * 60 * 1000).toISOString()
      : null;

    await supabase
      .from("notification_logs")
      .update({
        status: attempt >= 3 ? "failed" : "pending",
        attempts: attempt,
        last_attempt_at: new Date().toISOString(),
        next_retry_at: nextRetry,
        error_message: errorMsg,
        updated_at: new Date().toISOString(),
      })
      .eq("id", logId);

    // If max retries reached, notify CEO/Admin
    if (attempt >= 3) {
      try {
        const { data: admins } = await supabase
          .from("user_roles")
          .select("user_id")
          .in("role", ["vp", "admin"]);

        for (const admin of admins || []) {
          await supabase.rpc("create_notification", {
            p_user_id: admin.user_id,
            p_title: "⚠️ Email Delivery Failed",
            p_message: `Failed to deliver leave notification email to ${to} after 3 attempts. Error: ${errorMsg}`,
            p_type: "warning",
            p_link: "/notifications",
          });
        }
      } catch (notifErr) {
        console.error("Failed to notify admins of email failure:", notifErr);
      }
    }

    return { success: false, error: errorMsg };
  }
}

// ====== Email HTML Templates ======

function buildSubmittedEmail(name: string, type: string, start: string, end: string, days: number, reason?: string | null): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family:Arial,sans-serif;background:#f4f5f7;padding:20px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <h2 style="color:#1a1a2e;margin-top:0;">📋 New Leave Request</h2>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <tr><td style="padding:8px 0;color:#666;width:140px;">Employee</td><td style="padding:8px 0;font-weight:600;">${name}</td></tr>
      <tr><td style="padding:8px 0;color:#666;">Leave Type</td><td style="padding:8px 0;font-weight:600;">${type}</td></tr>
      <tr><td style="padding:8px 0;color:#666;">Start Date</td><td style="padding:8px 0;">${start}</td></tr>
      <tr><td style="padding:8px 0;color:#666;">End Date</td><td style="padding:8px 0;">${end}</td></tr>
      <tr><td style="padding:8px 0;color:#666;">Days</td><td style="padding:8px 0;font-weight:600;">${days}</td></tr>
      ${reason ? `<tr><td style="padding:8px 0;color:#666;">Reason</td><td style="padding:8px 0;">${reason}</td></tr>` : ""}
    </table>
    <p style="color:#666;font-size:14px;">Please log in to the HRM system to approve or reject this request.</p>
    <a href="https://hrm-focus.lovable.app/approvals" style="display:inline-block;background:#1a1a2e;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;margin-top:8px;">Review Request</a>
  </div>
</body>
</html>`;
}

function buildApprovedEmail(name: string, type: string, start: string, end: string, days: number, approver: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family:Arial,sans-serif;background:#f4f5f7;padding:20px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <h2 style="color:#16a34a;margin-top:0;">✅ Leave Request Approved</h2>
    <p>Hi ${name},</p>
    <p>Your leave request has been <strong>approved</strong> by ${approver}.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <tr><td style="padding:8px 0;color:#666;width:140px;">Leave Type</td><td style="padding:8px 0;font-weight:600;">${type}</td></tr>
      <tr><td style="padding:8px 0;color:#666;">Period</td><td style="padding:8px 0;">${start} to ${end}</td></tr>
      <tr><td style="padding:8px 0;color:#666;">Days</td><td style="padding:8px 0;font-weight:600;">${days}</td></tr>
    </table>
    <a href="https://hrm-focus.lovable.app/leave" style="display:inline-block;background:#16a34a;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;margin-top:8px;">View Details</a>
  </div>
</body>
</html>`;
}

function buildRejectedEmail(name: string, type: string, start: string, end: string, days: number, approver: string, reason?: string | null): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family:Arial,sans-serif;background:#f4f5f7;padding:20px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <h2 style="color:#dc2626;margin-top:0;">❌ Leave Request Rejected</h2>
    <p>Hi ${name},</p>
    <p>Your leave request has been <strong>rejected</strong> by ${approver}.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <tr><td style="padding:8px 0;color:#666;width:140px;">Leave Type</td><td style="padding:8px 0;font-weight:600;">${type}</td></tr>
      <tr><td style="padding:8px 0;color:#666;">Period</td><td style="padding:8px 0;">${start} to ${end}</td></tr>
      <tr><td style="padding:8px 0;color:#666;">Days</td><td style="padding:8px 0;font-weight:600;">${days}</td></tr>
      ${reason ? `<tr><td style="padding:8px 0;color:#666;">Reason</td><td style="padding:8px 0;color:#dc2626;">${reason}</td></tr>` : ""}
    </table>
    <a href="https://hrm-focus.lovable.app/leave" style="display:inline-block;background:#dc2626;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;margin-top:8px;">View Details</a>
  </div>
</body>
</html>`;
}
