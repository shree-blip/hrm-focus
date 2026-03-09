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

interface DocumentUploadPayload {
  uploader_name: string;
  uploader_email: string;
  document_name: string;
  document_category: string;
  employee_id?: string;
  employee_name?: string;
  notify_type: "employee_upload" | "manager_upload";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const payload: DocumentUploadPayload = await req.json();

    const {
      uploader_name,
      uploader_email,
      document_name,
      document_category,
      employee_id,
      employee_name,
      notify_type,
    } = payload;

    const allEmails: string[] = [];
    let emailSubject = "";
    let emailHtml = "";

    if (notify_type === "employee_upload") {
      // Employee uploaded a document → notify VP and line manager
      
      // Get VP emails
      const { data: vpUsers } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", ["vp", "admin"]);

      if (vpUsers) {
        const vpUserIds = vpUsers.map((v) => v.user_id);
        const { data: vpProfiles } = await supabase
          .from("profiles")
          .select("email")
          .in("user_id", vpUserIds);
        vpProfiles?.forEach((p) => p.email && allEmails.push(p.email));
      }

      // Get line manager email if employee_id is provided
      if (employee_id) {
        const { data: empData } = await supabase
          .from("employees")
          .select("line_manager_id, manager_id")
          .eq("id", employee_id)
          .single();

        if (empData) {
          // Get line manager email
          if (empData.line_manager_id) {
            const { data: lmData } = await supabase
              .from("employees")
              .select("email")
              .eq("id", empData.line_manager_id)
              .single();
            if (lmData?.email) allEmails.push(lmData.email);
          }
          // Get manager email as backup
          if (empData.manager_id) {
            const { data: mgrData } = await supabase
              .from("employees")
              .select("email")
              .eq("id", empData.manager_id)
              .single();
            if (mgrData?.email) allEmails.push(mgrData.email);
          }
        }
      }

      emailSubject = `📄 New Document Uploaded by ${uploader_name}`;
      emailHtml = buildEmployeeUploadEmail(uploader_name, uploader_email, document_name, document_category);

    } else if (notify_type === "manager_upload") {
      // VP/Manager uploaded for an employee → notify the employee
      if (employee_id) {
        const { data: empData } = await supabase
          .from("employees")
          .select("profile_id, email")
          .eq("id", employee_id)
          .single();

        if (empData?.email) {
          allEmails.push(empData.email);
        }
      }

      emailSubject = `📄 New Document Uploaded For You`;
      emailHtml = buildManagerUploadEmail(uploader_name, uploader_email, employee_name || "Employee", document_name, document_category);
    }

    // Add fixed CC
    allEmails.push(FIXED_CC_EMAIL);
    const uniqueEmails = [...new Set(allEmails)];

    const results: Array<{ target: string; success: boolean; error?: string }> = [];

    for (const email of uniqueEmails) {
      // Create notification log
      const { data: logEntry, error: logError } = await supabase
        .from("notification_logs")
        .insert({
          recipient_email: email,
          notification_type: "email",
          event_type: "document_upload",
          payload: { uploader_name, uploader_email, document_name, document_category, notify_type },
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

      const emailResult = await sendEmail(supabase, logEntry.id, email, emailSubject, emailHtml);
      results.push({ target: email, ...emailResult });
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("send-document-upload-notification error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

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
          p_message: `Failed to deliver document upload email to ${to} after 3 attempts. Error: ${errorMsg}`,
          p_type: "warning",
          p_link: "/notifications",
        });
      }
    }

    return { success: false, error: errorMsg };
  }
}

function buildEmployeeUploadEmail(
  uploaderName: string,
  uploaderEmail: string,
  documentName: string,
  documentCategory: string
): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family:Arial,sans-serif;background:#f4f5f7;padding:20px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <h2 style="color:#1a1a2e;margin-top:0;">📄 New Document Uploaded</h2>
    <p style="color:#333;">An employee has uploaded a new document to the system.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;background:#f9fafb;border-radius:6px;">
      <tr><td style="padding:12px;color:#666;width:140px;">Uploaded By</td><td style="padding:12px;font-weight:600;">${uploaderName}</td></tr>
      <tr><td style="padding:12px;color:#666;">Email</td><td style="padding:12px;">${uploaderEmail}</td></tr>
      <tr><td style="padding:12px;color:#666;">Document</td><td style="padding:12px;font-weight:600;">${documentName}</td></tr>
      <tr><td style="padding:12px;color:#666;">Category</td><td style="padding:12px;">${documentCategory}</td></tr>
    </table>
    <a href="https://hrm-focus.lovable.app/documents" style="display:inline-block;background:#1a1a2e;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;margin-top:8px;">View Documents</a>
    <p style="color:#999;font-size:12px;margin-top:24px;">This is an automated notification from HRM Focus.</p>
  </div>
</body>
</html>`;
}

function buildManagerUploadEmail(
  uploaderName: string,
  uploaderEmail: string,
  employeeName: string,
  documentName: string,
  documentCategory: string
): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family:Arial,sans-serif;background:#f4f5f7;padding:20px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <h2 style="color:#1a1a2e;margin-top:0;">📄 Document Uploaded For You</h2>
    <p style="color:#333;">Hi ${employeeName},</p>
    <p style="color:#333;">A new document has been uploaded to your file by management.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;background:#f9fafb;border-radius:6px;">
      <tr><td style="padding:12px;color:#666;width:140px;">Uploaded By</td><td style="padding:12px;font-weight:600;">${uploaderName}</td></tr>
      <tr><td style="padding:12px;color:#666;">Contact</td><td style="padding:12px;">${uploaderEmail}</td></tr>
      <tr><td style="padding:12px;color:#666;">Document</td><td style="padding:12px;font-weight:600;">${documentName}</td></tr>
      <tr><td style="padding:12px;color:#666;">Category</td><td style="padding:12px;">${documentCategory}</td></tr>
    </table>
    <p style="color:#666;font-size:14px;">You can view and download this document from the HRM system.</p>
    <a href="https://hrm-focus.lovable.app/documents" style="display:inline-block;background:#1a1a2e;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;margin-top:8px;">View Documents</a>
    <p style="color:#999;font-size:12px;margin-top:24px;">This is an automated notification from HRM Focus.</p>
  </div>
</body>
</html>`;
}
