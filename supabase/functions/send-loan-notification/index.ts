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

interface LoanNotificationPayload {
  event_type: "submitted" | "approved" | "rejected";
  employee_name: string;
  employee_email: string;
  amount: number;
  term_months: number;
  emi: number;
  reason_type: string;
  comment?: string;
  vp_name?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const payload: LoanNotificationPayload = await req.json();

    const {
      event_type,
      employee_name,
      employee_email,
      amount,
      term_months,
      emi,
      reason_type,
      comment,
      vp_name,
    } = payload;

    const formattedAmount = `NPR ${amount.toLocaleString()}`;
    const formattedEMI = `NPR ${emi.toLocaleString()}`;
    const results: Array<{ target: string; success: boolean; error?: string }> = [];

    if (event_type === "submitted") {
      // Notify all VP/Admin users by email
      const { data: vpUsers } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", ["vp", "admin"]);

      const vpEmails: string[] = [];
      if (vpUsers) {
        const vpIds = vpUsers.map((v) => v.user_id);
        const { data: vpProfiles } = await supabase
          .from("profiles")
          .select("email")
          .in("user_id", vpIds);
        vpProfiles?.forEach((p) => p.email && vpEmails.push(p.email));
      }

      const allEmails = [...new Set([...vpEmails, FIXED_CC_EMAIL])];
      const subject = `💰 New Loan Request from ${employee_name}`;
      const html = buildSubmittedEmail(employee_name, employee_email, formattedAmount, term_months, formattedEMI, reason_type);

      for (const email of allEmails) {
        const result = await sendEmailWithLog(supabase, email, subject, html, event_type, { employee_name, amount, term_months });
        results.push({ target: email, ...result });
      }

    } else if (event_type === "approved" || event_type === "rejected") {
      // Notify the employee
      const allEmails = [...new Set([employee_email, FIXED_CC_EMAIL])];
      const subject = event_type === "approved"
        ? `✅ Loan Request Approved`
        : `❌ Loan Request Rejected`;
      const html = event_type === "approved"
        ? buildApprovedEmail(employee_name, formattedAmount, term_months, formattedEMI, vp_name || "CEO", comment)
        : buildRejectedEmail(employee_name, formattedAmount, vp_name || "CEO", comment);

      for (const email of allEmails) {
        const result = await sendEmailWithLog(supabase, email, subject, html, event_type, { employee_name, amount, term_months, comment });
        results.push({ target: email, ...result });
      }
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("send-loan-notification error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function sendEmailWithLog(
  supabase: any,
  email: string,
  subject: string,
  html: string,
  eventType: string,
  payloadData: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  const { data: logEntry, error: logError } = await supabase
    .from("notification_logs")
    .insert({
      recipient_email: email,
      notification_type: "email",
      event_type: `loan_${eventType}`,
      payload: payloadData,
      status: "pending",
      attempts: 0,
      next_retry_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (logError) {
    console.error("Failed to create notification log:", logError);
    return { success: false, error: String(logError) };
  }

  return sendEmail(supabase, logEntry.id, email, subject, html);
}

async function sendEmail(
  supabase: ReturnType<typeof createClient>,
  logId: string,
  to: string,
  subject: string,
  html: string,
  attempt = 1
): Promise<{ success: boolean; error?: string }> {
  if (!RESEND_API_KEY) {
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
      const { data: admins } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", ["vp", "admin"]);
      for (const admin of admins || []) {
        await supabase.rpc("create_notification", {
          p_user_id: admin.user_id,
          p_title: "⚠️ Email Delivery Failed",
          p_message: `Failed to deliver loan notification email to ${to} after 3 attempts. Error: ${errorMsg}`,
          p_type: "warning",
          p_link: "/notifications",
        });
      }
    }

    return { success: false, error: errorMsg };
  }
}

// ===== Email Templates =====

function buildSubmittedEmail(name: string, email: string, amount: string, term: number, emi: string, reasonType: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family:Arial,sans-serif;background:#f4f5f7;padding:20px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <h2 style="color:#1a1a2e;margin-top:0;">💰 New Loan Request</h2>
    <p style="color:#333;">A new loan request has been submitted and requires your review.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;background:#f9fafb;border-radius:6px;">
      <tr><td style="padding:12px;color:#666;width:140px;">Employee</td><td style="padding:12px;font-weight:600;">${name}</td></tr>
      <tr><td style="padding:12px;color:#666;">Email</td><td style="padding:12px;">${email}</td></tr>
      <tr><td style="padding:12px;color:#666;">Amount</td><td style="padding:12px;font-weight:600;color:#1a1a2e;">${amount}</td></tr>
      <tr><td style="padding:12px;color:#666;">Term</td><td style="padding:12px;">${term} months</td></tr>
      <tr><td style="padding:12px;color:#666;">Monthly EMI</td><td style="padding:12px;font-weight:600;">${emi}</td></tr>
      <tr><td style="padding:12px;color:#666;">Reason</td><td style="padding:12px;">${reasonType}</td></tr>
    </table>
    <a href="https://hrm-focus.lovable.app/loans" style="display:inline-block;background:#1a1a2e;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;margin-top:8px;">Review Request</a>
    <p style="color:#999;font-size:12px;margin-top:24px;">This is an automated notification from HRM Focus.</p>
  </div>
</body>
</html>`;
}

function buildApprovedEmail(name: string, amount: string, term: number, emi: string, approverName: string, comment?: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family:Arial,sans-serif;background:#f4f5f7;padding:20px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <h2 style="color:#16a34a;margin-top:0;">✅ Loan Request Approved</h2>
    <p style="color:#333;">Hi ${name},</p>
    <p style="color:#333;">Great news! Your loan request has been <strong>approved</strong> by ${approverName}.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;background:#f0fdf4;border-radius:6px;">
      <tr><td style="padding:12px;color:#666;width:140px;">Amount</td><td style="padding:12px;font-weight:600;color:#16a34a;">${amount}</td></tr>
      <tr><td style="padding:12px;color:#666;">Term</td><td style="padding:12px;">${term} months</td></tr>
      <tr><td style="padding:12px;color:#666;">Monthly EMI</td><td style="padding:12px;font-weight:600;">${emi}</td></tr>
      <tr><td style="padding:12px;color:#666;">Approved By</td><td style="padding:12px;">${approverName}</td></tr>
      ${comment ? `<tr><td style="padding:12px;color:#666;">Note</td><td style="padding:12px;font-style:italic;">${comment}</td></tr>` : ""}
    </table>
    <p style="color:#666;font-size:14px;">The disbursement will be processed as per company policy. Please log in to view full details.</p>
    <a href="https://hrm-focus.lovable.app/loans" style="display:inline-block;background:#16a34a;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;margin-top:8px;">View Loan Details</a>
    <p style="color:#999;font-size:12px;margin-top:24px;">This is an automated notification from HRM Focus.</p>
  </div>
</body>
</html>`;
}

function buildRejectedEmail(name: string, amount: string, approverName: string, comment?: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family:Arial,sans-serif;background:#f4f5f7;padding:20px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <h2 style="color:#dc2626;margin-top:0;">❌ Loan Request Rejected</h2>
    <p style="color:#333;">Hi ${name},</p>
    <p style="color:#333;">We regret to inform you that your loan request for <strong>${amount}</strong> has been <strong>rejected</strong> by ${approverName}.</p>
    ${comment ? `
    <div style="background:#fef2f2;border-left:4px solid #dc2626;padding:12px 16px;border-radius:4px;margin:16px 0;">
      <p style="color:#dc2626;font-weight:600;margin:0 0 4px;">Reason:</p>
      <p style="color:#333;margin:0;">${comment}</p>
    </div>` : ""}
    <p style="color:#666;font-size:14px;">If you believe this decision was made in error or have additional information, please contact HR.</p>
    <a href="https://hrm-focus.lovable.app/loans" style="display:inline-block;background:#dc2626;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;margin-top:8px;">View Details</a>
    <p style="color:#999;font-size:12px;margin-top:24px;">This is an automated notification from HRM Focus.</p>
  </div>
</body>
</html>`;
}
