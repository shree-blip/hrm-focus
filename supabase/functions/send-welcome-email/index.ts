import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FIXED_CC_EMAIL = "hello@focusyourfinance.com";

interface WelcomeEmailPayload {
  employee_id: string;
  first_name: string;
  last_name: string;
  email: string;
  job_title?: string;
  department?: string;
  start_date?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify caller is authenticated and has admin/vp role
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: authError } = await anonClient.auth.getUser();
    if (authError || !userData?.user?.id) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller has admin or vp role
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .limit(1)
      .single();

    const callerRole = roleData?.role;
    if (!callerRole || !["admin", "vp", "supervisor"].includes(callerRole)) {
      return new Response(JSON.stringify({ error: "Forbidden: insufficient role" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload: WelcomeEmailPayload = await req.json();

    // Log the notification
    const { data: logEntry } = await supabase
      .from("notification_logs")
      .insert({
        type: "welcome_email",
        recipient_email: payload.email,
        subject: `Welcome to HRM Focus, ${payload.first_name}!`,
        status: "pending",
        metadata: {
          employee_id: payload.employee_id,
          first_name: payload.first_name,
          last_name: payload.last_name,
          department: payload.department,
          job_title: payload.job_title,
        },
      })
      .select("id")
      .single();

    const logId = logEntry?.id;

    // Also auto-whitelist the email in allowed_signups
    await supabase
      .from("allowed_signups")
      .upsert(
        {
          email: payload.email.toLowerCase(),
          employee_id: payload.employee_id,
          invited_at: new Date().toISOString(),
        },
        { onConflict: "email" }
      );

    // Build the email HTML
    const portalUrl = "https://hrm-focus.lovable.app";
    const startDateFormatted = payload.start_date
      ? new Date(payload.start_date).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : null;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);padding:32px 40px;text-align:center;">
              <h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:700;">Welcome to HRM Focus! 🎉</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <p style="font-size:16px;color:#333;margin:0 0 20px;">
                Hi <strong>${payload.first_name}</strong>,
              </p>
              <p style="font-size:15px;color:#555;line-height:1.6;margin:0 0 20px;">
                We're thrilled to welcome you to the team! Your employee account has been created in our HR Management portal.
              </p>

              <!-- Details Card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8f9fb;border-radius:8px;padding:20px;margin:0 0 24px;">
                <tr>
                  <td style="padding:20px;">
                    <p style="font-size:14px;color:#888;margin:0 0 12px;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Your Details</p>
                    <table width="100%" cellpadding="4" cellspacing="0">
                      <tr>
                        <td style="font-size:14px;color:#888;width:120px;">Name</td>
                        <td style="font-size:14px;color:#333;font-weight:600;">${payload.first_name} ${payload.last_name}</td>
                      </tr>
                      ${payload.job_title ? `<tr><td style="font-size:14px;color:#888;">Position</td><td style="font-size:14px;color:#333;font-weight:600;">${payload.job_title}</td></tr>` : ""}
                      ${payload.department ? `<tr><td style="font-size:14px;color:#888;">Department</td><td style="font-size:14px;color:#333;font-weight:600;">${payload.department}</td></tr>` : ""}
                      ${startDateFormatted ? `<tr><td style="font-size:14px;color:#888;">Start Date</td><td style="font-size:14px;color:#333;font-weight:600;">${startDateFormatted}</td></tr>` : ""}
                      <tr>
                        <td style="font-size:14px;color:#888;">Email</td>
                        <td style="font-size:14px;color:#333;font-weight:600;">${payload.email}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Login Instructions -->
              <p style="font-size:15px;color:#555;line-height:1.6;margin:0 0 8px;">
                <strong>To get started:</strong>
              </p>
              <ol style="font-size:14px;color:#555;line-height:1.8;margin:0 0 24px;padding-left:20px;">
                <li>Visit the HRM portal using the button below</li>
                <li>Click <strong>"Create Account"</strong> on the login page</li>
                <li>Sign up using this email address: <strong>${payload.email}</strong></li>
                <li>Set a secure password and verify your email</li>
              </ol>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0 24px;">
                    <a href="${portalUrl}" 
                       style="display:inline-block;background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:600;">
                      Go to HRM Portal →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="font-size:13px;color:#999;line-height:1.5;margin:0;border-top:1px solid #eee;padding-top:20px;">
                If you have any questions, please reach out to your manager or the HR team at 
                <a href="mailto:hello@focusyourfinance.com" style="color:#1a1a2e;">hello@focusyourfinance.com</a>.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#f8f9fb;padding:20px 40px;text-align:center;">
              <p style="font-size:12px;color:#999;margin:0;">
                © ${new Date().getFullYear()} Focus Your Finance · HRM Focus Portal
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    // Send via Resend
    const result = await sendEmailWithResend(
      supabase,
      logId,
      payload.email,
      `Welcome to HRM Focus, ${payload.first_name}! 🎉`,
      html
    );

    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in send-welcome-email:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function sendEmailWithResend(
  supabase: any,
  logId: string | undefined,
  to: string,
  subject: string,
  html: string,
  attempt = 1
): Promise<{ success: boolean; error?: string }> {
  if (!RESEND_API_KEY) {
    if (logId) {
      await supabase
        .from("notification_logs")
        .update({
          status: "skipped",
          error_message: "RESEND_API_KEY not configured",
          updated_at: new Date().toISOString(),
        })
        .eq("id", logId);
    }
    return { success: false, error: "RESEND_API_KEY not configured" };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "HRM Focus <noreply@notifications.focusyourfinance.com>",
      to: [to],
      cc: [FIXED_CC_EMAIL],
      subject,
      html,
    }),
  });

  const responseText = await response.text();

  if (response.ok) {
    if (logId) {
      await supabase
        .from("notification_logs")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          attempt_count: attempt,
        })
        .eq("id", logId);
    }
    console.log(`Welcome email sent to ${to}`);
    return { success: true };
  } else {
    console.error(`Failed to send welcome email to ${to}:`, responseText);
    if (logId) {
      await supabase
        .from("notification_logs")
        .update({
          status: attempt < 3 ? "pending" : "failed",
          error_message: responseText,
          updated_at: new Date().toISOString(),
          attempt_count: attempt,
        })
        .eq("id", logId);
    }
    return { success: false, error: responseText };
  }
}
