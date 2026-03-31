import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FIXED_CC_EMAIL = "hello@focusyourfinance.com";

interface TeamNotificationPayload {
  action: "assigned" | "removed";
  assigner_name: string;
  assigner_email: string;
  employee_name: string;
  employee_email: string;
  manager_name: string;
  removal_reason?: string;
}

// Backward-compatible: if no "action" field is provided, default to "assigned"
function normalizePayload(raw: any): TeamNotificationPayload {
  return {
    action: raw.action || "assigned",
    assigner_name: raw.assigner_name,
    assigner_email: raw.assigner_email,
    employee_name: raw.employee_name,
    employee_email: raw.employee_email,
    manager_name: raw.manager_name,
    removal_reason: raw.removal_reason,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const anonClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const rawPayload = await req.json();
    const payload = normalizePayload(rawPayload);

    const { action, assigner_name, assigner_email, employee_name, employee_email, manager_name, removal_reason } =
      payload;

    const isRemoval = action === "removed";
    const eventType = isRemoval ? "team_removal" : "team_assignment";

    const emailSubject = isRemoval
      ? `🔄 You've Been Removed from ${manager_name}'s Team`
      : `👥 You've Been Added to ${manager_name}'s Team`;

    const emailHtml = isRemoval
      ? buildTeamRemovalEmail(assigner_name, assigner_email, employee_name, manager_name, removal_reason)
      : buildTeamAssignmentEmail(assigner_name, assigner_email, employee_name, manager_name);

    // Send to the employee + fixed CC
    const allEmails = [...new Set([employee_email, FIXED_CC_EMAIL])];
    const results: Array<{ target: string; success: boolean; error?: string }> = [];

    for (const email of allEmails) {
      // Create notification log
      const { data: logEntry, error: logError } = await supabase
        .from("notification_logs")
        .insert({
          recipient_email: email,
          notification_type: "email",
          event_type: eventType,
          payload: {
            action,
            assigner_name,
            assigner_email,
            employee_name,
            employee_email,
            manager_name,
            removal_reason,
          },
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

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("send-team-notification error:", error);
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
          p_message: `Failed to deliver team notification email to ${to} after 3 attempts. Error: ${errorMsg}`,
          p_type: "warning",
          p_link: "/notifications",
        });
      }
    }

    return { success: false, error: errorMsg };
  }
}

function buildTeamAssignmentEmail(
  assignerName: string,
  assignerEmail: string,
  employeeName: string,
  managerName: string,
): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family:Arial,sans-serif;background:#f4f5f7;padding:20px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <h2 style="color:#1a1a2e;margin-top:0;">👥 You've Been Added to a Team</h2>
    <p style="color:#333;">Hi ${employeeName},</p>
    <p style="color:#333;">Great news! You have been added to <strong>${managerName}'s team</strong>.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;background:#f9fafb;border-radius:6px;">
      <tr><td style="padding:12px;color:#666;width:140px;">Added By</td><td style="padding:12px;font-weight:600;">${assignerName}</td></tr>
      <tr><td style="padding:12px;color:#666;">Contact</td><td style="padding:12px;">${assignerEmail}</td></tr>
      <tr><td style="padding:12px;color:#666;">Team Manager</td><td style="padding:12px;font-weight:600;">${managerName}</td></tr>
    </table>
    <p style="color:#666;font-size:14px;">You can view your team information in the HRM system.</p>
    <a href="https://hrm-focus.lovable.app/employees" style="display:inline-block;background:#1a1a2e;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;margin-top:8px;">View Team</a>
    <p style="color:#999;font-size:12px;margin-top:24px;">This is an automated notification from HRM Focus.</p>
  </div>
</body>
</html>`;
}

function buildTeamRemovalEmail(
  assignerName: string,
  assignerEmail: string,
  employeeName: string,
  managerName: string,
  removalReason?: string,
): string {
  const reasonRow = removalReason
    ? `<tr><td style="padding:12px;color:#666;">Reason</td><td style="padding:12px;">${removalReason}</td></tr>`
    : "";

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family:Arial,sans-serif;background:#f4f5f7;padding:20px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <h2 style="color:#1a1a2e;margin-top:0;">🔄 Team Change Notification</h2>
    <p style="color:#333;">Hi ${employeeName},</p>
    <p style="color:#333;">This is to inform you that you have been removed from <strong>${managerName}'s team</strong>.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;background:#f9fafb;border-radius:6px;">
      <tr><td style="padding:12px;color:#666;width:140px;">Removed By</td><td style="padding:12px;font-weight:600;">${assignerName}</td></tr>
      <tr><td style="padding:12px;color:#666;">Contact</td><td style="padding:12px;">${assignerEmail}</td></tr>
      <tr><td style="padding:12px;color:#666;">Previous Team</td><td style="padding:12px;font-weight:600;">${managerName}</td></tr>
      ${reasonRow}
    </table>
    <p style="color:#666;font-size:14px;">If you have any questions about this change, please reach out to your HR administrator or the contact listed above.</p>
    <a href="https://hrm-focus.lovable.app/employees" style="display:inline-block;background:#1a1a2e;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;margin-top:8px;">View Details</a>
    <p style="color:#999;font-size:12px;margin-top:24px;">This is an automated notification from HRM Focus.</p>
  </div>
</body>
</html>`;
}
