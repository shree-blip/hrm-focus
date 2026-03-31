import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
    // Authenticate the caller
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
    const payload: LeaveNotificationPayload = await req.json();

    const {
      leave_request_id,
      event_type,
      employee_name,
      employee_email,
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

    const dateRange = `${start_date} to ${end_date}`;

    // =========================
    // 1. BUILD IN-APP CONTENT
    // =========================
    let title: string;
    let message: string;

    if (event_type === "submitted") {
      title = `📋 New Leave Request from ${employee_name}`;
      message = `${employee_name} submitted a ${leave_type} request for ${days} day(s) (${dateRange}).${reason ? ` Reason: ${reason}` : ""}`;
    } else if (event_type === "approved") {
      title = `✅ Leave Request Approved`;
      message = `Your ${leave_type} request for ${days} day(s) (${dateRange}) has been approved by ${approver_name || "Manager"}.`;
    } else if (event_type === "rejected") {
      title = `❌ Leave Request Rejected`;
      message = `Your ${leave_type} request for ${days} day(s) (${dateRange}) has been rejected by ${approver_name || "Manager"}.${rejection_reason ? ` Reason: ${rejection_reason}` : ""}`;
    } else {
      return new Response(JSON.stringify({ error: "Invalid event_type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: Array<{ type: string; target: string; success: boolean; error?: string }> = [];

    // =========================
    // 2. CREATE IN-APP NOTIFICATIONS
    // =========================
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
        results.push({
          type: "in_app",
          target: userId,
          success: false,
          error: String(err),
        });
      }
    }

    // =========================
    // 3. SPLIT EMAIL RECIPIENTS
    // =========================
    const normalizedTargetEmails = [...new Set(target_emails.filter(Boolean))];
    const normalizedEmployeeEmail = employee_email?.trim().toLowerCase() || "";

    let employeeRecipients: string[] = [];
    let managementRecipients: string[] = [];

    if (normalizedEmployeeEmail) {
      employeeRecipients = normalizedTargetEmails.filter(
        (email) => email.trim().toLowerCase() === normalizedEmployeeEmail,
      );

      managementRecipients = normalizedTargetEmails.filter(
        (email) => email.trim().toLowerCase() !== normalizedEmployeeEmail,
      );
    } else {
      // If employee_email is not supplied, then we cannot safely distinguish.
      // For submitted requests, target_emails are usually management anyway.
      // For approved/rejected, if employee_email is missing, fall back to sending
      // the management template to target emails to avoid "Hi Employee" going to admins.
      employeeRecipients = [];
      managementRecipients = normalizedTargetEmails;
    }

    // 🚫 Remove CEO emails from management recipients
    const { data: ceoUsers } = await supabase.from("user_roles").select("user_id").eq("role", "vp");

    const { data: ceoProfiles } = await supabase
      .from("profiles")
      .select("email")
      .in(
        "id",
        (ceoUsers || []).map((u) => u.user_id),
      );

    const ceoEmails = (ceoProfiles || []).map((p) => p.email?.toLowerCase()).filter(Boolean);

    managementRecipients = managementRecipients.filter((email) => !ceoEmails.includes(email.toLowerCase()));

    // CC goes only to management-side emails, not to employee-facing email
    if (!managementRecipients.includes(FIXED_CC_EMAIL)) {
      managementRecipients.push(FIXED_CC_EMAIL);
    }

    // =========================
    // 4. SEND EMAILS BY EVENT TYPE
    // =========================

    // ---- SUBMITTED ----
    if (event_type === "submitted") {
      const subject = `Leave Request: ${employee_name} - ${leave_type} (${days} days)`;
      const html = buildSubmittedEmail(employee_name, leave_type, start_date, end_date, days, reason);

      for (const email of managementRecipients) {
        const logEntry = await createNotificationLog(supabase, {
          recipient_email: email,
          event_type,
          payload: {
            leave_request_id,
            employee_name,
            leave_type,
            start_date,
            end_date,
            days,
            recipient_group: "management",
          },
          status: "pending",
        });

        const emailResult = await sendEmailWithRetry(supabase, logEntry.id, email, subject, html);

        results.push({
          type: "email",
          target: email,
          success: emailResult.success,
          error: emailResult.error,
        });
      }
    }

    // ---- APPROVED ----
    else if (event_type === "approved") {
      // Employee-facing email
      if (employeeRecipients.length > 0) {
        const employeeSubject = `Leave Approved: ${leave_type} (${days} days)`;
        const employeeHtml = buildApprovedEmployeeEmail(
          employee_name,
          leave_type,
          start_date,
          end_date,
          days,
          approver_name || "Manager",
        );

        for (const email of employeeRecipients) {
          const logEntry = await createNotificationLog(supabase, {
            recipient_email: email,
            event_type,
            payload: {
              leave_request_id,
              employee_name,
              leave_type,
              start_date,
              end_date,
              days,
              approver_name,
              recipient_group: "employee",
            },
            status: "pending",
          });

          const emailResult = await sendEmailWithRetry(supabase, logEntry.id, email, employeeSubject, employeeHtml);

          results.push({
            type: "email",
            target: email,
            success: emailResult.success,
            error: emailResult.error,
          });
        }
      }

      // Management-facing email
      if (managementRecipients.length > 0) {
        const managementSubject = `Leave Approved: ${employee_name} - ${leave_type} (${days} days)`;
        const managementHtml = buildApprovedManagementEmail(
          employee_name,
          leave_type,
          start_date,
          end_date,
          days,
          approver_name || "Manager",
        );

        for (const email of managementRecipients) {
          const logEntry = await createNotificationLog(supabase, {
            recipient_email: email,
            event_type,
            payload: {
              leave_request_id,
              employee_name,
              leave_type,
              start_date,
              end_date,
              days,
              approver_name,
              recipient_group: "management",
            },
            status: "pending",
          });

          const emailResult = await sendEmailWithRetry(supabase, logEntry.id, email, managementSubject, managementHtml);

          results.push({
            type: "email",
            target: email,
            success: emailResult.success,
            error: emailResult.error,
          });
        }
      }
    }

    // ---- REJECTED ----
    else if (event_type === "rejected") {
      // Employee-facing email
      if (employeeRecipients.length > 0) {
        const employeeSubject = `Leave Rejected: ${leave_type} (${days} days)`;
        const employeeHtml = buildRejectedEmployeeEmail(
          employee_name,
          leave_type,
          start_date,
          end_date,
          days,
          approver_name || "Manager",
          rejection_reason,
        );

        for (const email of employeeRecipients) {
          const logEntry = await createNotificationLog(supabase, {
            recipient_email: email,
            event_type,
            payload: {
              leave_request_id,
              employee_name,
              leave_type,
              start_date,
              end_date,
              days,
              approver_name,
              rejection_reason,
              recipient_group: "employee",
            },
            status: "pending",
          });

          const emailResult = await sendEmailWithRetry(supabase, logEntry.id, email, employeeSubject, employeeHtml);

          results.push({
            type: "email",
            target: email,
            success: emailResult.success,
            error: emailResult.error,
          });
        }
      }

      // Management-facing email
      if (managementRecipients.length > 0) {
        const managementSubject = `Leave Rejected: ${employee_name} - ${leave_type} (${days} days)`;
        const managementHtml = buildRejectedManagementEmail(
          employee_name,
          leave_type,
          start_date,
          end_date,
          days,
          approver_name || "Manager",
          rejection_reason,
        );

        for (const email of managementRecipients) {
          const logEntry = await createNotificationLog(supabase, {
            recipient_email: email,
            event_type,
            payload: {
              leave_request_id,
              employee_name,
              leave_type,
              start_date,
              end_date,
              days,
              approver_name,
              rejection_reason,
              recipient_group: "management",
            },
            status: "pending",
          });

          const emailResult = await sendEmailWithRetry(supabase, logEntry.id, email, managementSubject, managementHtml);

          results.push({
            type: "email",
            target: email,
            success: emailResult.success,
            error: emailResult.error,
          });
        }
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("send-leave-notification error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function createNotificationLog(
  supabase: any,
  data: {
    recipient_email: string;
    event_type: string;
    payload: Record<string, unknown>;
    status: string;
    notification_id?: string;
    recipient_user_id?: string;
  },
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
  supabase: any,
  logId: string,
  to: string,
  subject: string,
  html: string,
  attempt = 1,
): Promise<{ success: boolean; error?: string }> {
  if (!RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not set, skipping email");
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

    const nextRetry = attempt < 3 ? new Date(Date.now() + 2 * 60 * 1000).toISOString() : null;

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

    if (attempt >= 3) {
      try {
        const { data: admins } = await supabase.from("user_roles").select("user_id").in("role", ["admin"]);

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

// ====== EMAIL HTML TEMPLATES ======

function buildSubmittedEmail(
  name: string,
  type: string,
  start: string,
  end: string,
  days: number,
  reason?: string | null,
): string {
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

function buildApprovedEmployeeEmail(
  name: string,
  type: string,
  start: string,
  end: string,
  days: number,
  approver: string,
): string {
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

function buildApprovedManagementEmail(
  employeeName: string,
  type: string,
  start: string,
  end: string,
  days: number,
  approver: string,
): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family:Arial,sans-serif;background:#f4f5f7;padding:20px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <h2 style="color:#16a34a;margin-top:0;">✅ Leave Request Approved</h2>
    <p>A leave request has been <strong>approved</strong>.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <tr><td style="padding:8px 0;color:#666;width:160px;">Employee</td><td style="padding:8px 0;font-weight:600;">${employeeName}</td></tr>
      <tr><td style="padding:8px 0;color:#666;">Approved By</td><td style="padding:8px 0;font-weight:600;">${approver}</td></tr>
      <tr><td style="padding:8px 0;color:#666;">Leave Type</td><td style="padding:8px 0;">${type}</td></tr>
      <tr><td style="padding:8px 0;color:#666;">Period</td><td style="padding:8px 0;">${start} to ${end}</td></tr>
      <tr><td style="padding:8px 0;color:#666;">Days</td><td style="padding:8px 0;font-weight:600;">${days}</td></tr>
    </table>
    <a href="https://hrm-focus.lovable.app/leave" style="display:inline-block;background:#16a34a;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;margin-top:8px;">View Details</a>
  </div>
</body>
</html>`;
}

function buildRejectedEmployeeEmail(
  name: string,
  type: string,
  start: string,
  end: string,
  days: number,
  approver: string,
  reason?: string | null,
): string {
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

function buildRejectedManagementEmail(
  employeeName: string,
  type: string,
  start: string,
  end: string,
  days: number,
  approver: string,
  reason?: string | null,
): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family:Arial,sans-serif;background:#f4f5f7;padding:20px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <h2 style="color:#dc2626;margin-top:0;">❌ Leave Request Rejected</h2>
    <p>A leave request has been <strong>rejected</strong>.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <tr><td style="padding:8px 0;color:#666;width:160px;">Employee</td><td style="padding:8px 0;font-weight:600;">${employeeName}</td></tr>
      <tr><td style="padding:8px 0;color:#666;">Rejected By</td><td style="padding:8px 0;font-weight:600;">${approver}</td></tr>
      <tr><td style="padding:8px 0;color:#666;">Leave Type</td><td style="padding:8px 0;">${type}</td></tr>
      <tr><td style="padding:8px 0;color:#666;">Period</td><td style="padding:8px 0;">${start} to ${end}</td></tr>
      <tr><td style="padding:8px 0;color:#666;">Days</td><td style="padding:8px 0;font-weight:600;">${days}</td></tr>
      ${reason ? `<tr><td style="padding:8px 0;color:#666;">Reason</td><td style="padding:8px 0;color:#dc2626;">${reason}</td></tr>` : ""}
    </table>
    <a href="https://hrm-focus.lovable.app/leave" style="display:inline-block;background:#dc2626;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;margin-top:8px;">View Details</a>
  </div>
</body>
</html>`;
}
