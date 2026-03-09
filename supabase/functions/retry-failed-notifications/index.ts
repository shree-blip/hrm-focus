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

    // Fetch pending logs that are due for retry
    const { data: pendingLogs, error } = await supabase
      .from("notification_logs")
      .select("*")
      .eq("status", "pending")
      .lt("next_retry_at", new Date().toISOString())
      .lt("attempts", 3)
      .order("next_retry_at", { ascending: true })
      .limit(50);

    if (error) {
      console.error("Error fetching pending logs:", error);
      throw error;
    }

    if (!pendingLogs || pendingLogs.length === 0) {
      return new Response(JSON.stringify({ message: "No pending retries", processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let processed = 0;
    let succeeded = 0;
    let failed = 0;

    for (const log of pendingLogs) {
      processed++;
      const attempt = (log.attempts || 0) + 1;
      const payload = log.payload as Record<string, unknown>;

      // Rebuild email from payload
      const { employee_name, leave_type, start_date, end_date, days } = payload as {
        employee_name: string;
        leave_type: string;
        start_date: string;
        end_date: string;
        days: number;
      };

      const subject = `Leave Request: ${employee_name} - ${leave_type} (${days} days)`;
      const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;background:#f4f5f7;padding:20px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;padding:32px;">
    <h2 style="color:#1a1a2e;">📋 Leave Request (Retry)</h2>
    <p><strong>${employee_name}</strong> requested <strong>${leave_type}</strong> for <strong>${days}</strong> day(s).</p>
    <p>Period: ${start_date} to ${end_date}</p>
    <a href="https://hrm-focus.lovable.app/approvals" style="display:inline-block;background:#1a1a2e;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;">Review Request</a>
  </div>
</body>
</html>`;

      if (!RESEND_API_KEY) {
        await supabase
          .from("notification_logs")
          .update({ status: "skipped", error_message: "RESEND_API_KEY not configured", updated_at: new Date().toISOString() })
          .eq("id", log.id);
        failed++;
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
            to: [log.recipient_email],
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
            error_message: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", log.id);
        succeeded++;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        const isMaxAttempts = attempt >= 3;
        const nextRetry = isMaxAttempts ? null : new Date(Date.now() + 2 * 60 * 1000).toISOString();

        await supabase
          .from("notification_logs")
          .update({
            status: isMaxAttempts ? "failed" : "pending",
            attempts: attempt,
            last_attempt_at: new Date().toISOString(),
            next_retry_at: nextRetry,
            error_message: errorMsg,
            updated_at: new Date().toISOString(),
          })
          .eq("id", log.id);

        // Notify admins on final failure
        if (isMaxAttempts) {
          const { data: admins } = await supabase
            .from("user_roles")
            .select("user_id")
            .in("role", ["vp", "admin"]);

          for (const admin of admins || []) {
            await supabase.rpc("create_notification", {
              p_user_id: admin.user_id,
              p_title: "⚠️ Email Delivery Failed",
              p_message: `Failed to deliver email to ${log.recipient_email} after 3 attempts. Error: ${errorMsg}`,
              p_type: "warning",
              p_link: "/notifications",
            });
          }
        }
        failed++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed, succeeded, failed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("retry-failed-notifications error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
