import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FIXED_CC_EMAIL = "hello@focusyourfinance.com";

interface MilestoneRecord {
  user_id: string;
  first_name: string;
  last_name: string;
  milestone_type: string;
  years: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    const cronSecret = Deno.env.get("CRON_SECRET");
    
    if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
      console.log("Authenticated via CRON_SECRET");
    } else if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get today's milestones
    const { data: milestones, error: milestonesError } = await supabase.rpc("get_todays_milestones");

    if (milestonesError) {
      console.error("Error fetching milestones:", milestonesError);
      throw milestonesError;
    }

    console.log("Today's milestones:", milestones);

    if (!milestones || milestones.length === 0) {
      console.log("No milestones today");
      return new Response(
        JSON.stringify({ message: "No milestones today", count: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get all active users with emails
    const { data: allProfiles, error: profilesError } = await supabase
      .from("profiles")
      .select("user_id, email, first_name, last_name")
      .not("user_id", "is", null);

    if (profilesError) {
      console.error("Error fetching profiles:", profilesError);
      throw profilesError;
    }

    const allUserIds = allProfiles?.map((p) => p.user_id) || [];
    const allEmails = allProfiles?.filter((p) => p.email).map((p) => p.email!) || [];
    console.log(`Found ${allUserIds.length} users to notify, ${allEmails.length} with emails`);

    // ===== In-app notifications =====
    const notifications: {
      user_id: string;
      title: string;
      message: string;
      type: string;
      link: string;
    }[] = [];

    for (const milestone of milestones as MilestoneRecord[]) {
      for (const userId of allUserIds) {
        if (userId === milestone.user_id) continue;

        let title: string;
        let message: string;

        if (milestone.milestone_type === "birthday") {
          title = `🎂 Birthday Celebration!`;
          message = `Today is ${milestone.first_name} ${milestone.last_name}'s birthday! Wish them a happy birthday! 🎉`;
        } else {
          const yearsText = milestone.years === 1 ? "1 year" : `${milestone.years} years`;
          title = `🎊 Work Anniversary!`;
          message = `${milestone.first_name} ${milestone.last_name} celebrates ${yearsText} with the company today! Congratulations! 🎉`;
        }

        notifications.push({ user_id: userId, title, message, type: "celebration", link: "/notifications" });
      }
    }

    console.log(`Creating ${notifications.length} in-app notifications`);

    if (notifications.length > 0) {
      const batchSize = 100;
      for (let i = 0; i < notifications.length; i += batchSize) {
        const batch = notifications.slice(i, i + batchSize);
        const { error: insertError } = await supabase.from("notifications").insert(batch);
        if (insertError) console.error("Error inserting notifications batch:", insertError);
      }
    }

    // ===== Email notifications =====
    const emailResults: Array<{ target: string; success: boolean; error?: string }> = [];

    if (RESEND_API_KEY) {
      // Build one email per milestone, sent to all employees
      for (const milestone of milestones as MilestoneRecord[]) {
        const { subject, html } = buildMilestoneEmail(milestone);

        // Collect all emails except the person themselves + add CC
        const recipientEmails = [
          ...new Set([
            ...allEmails.filter((e) => {
              const profile = allProfiles?.find((p) => p.email === e);
              return profile?.user_id !== milestone.user_id;
            }),
            FIXED_CC_EMAIL,
          ]),
        ];

        console.log(`Sending milestone email for ${milestone.first_name} to ${recipientEmails.length} recipients`);

        // Send emails with delay to avoid rate limiting
        for (let i = 0; i < recipientEmails.length; i++) {
          const email = recipientEmails[i];

          // Log the notification
          const { data: logEntry, error: logError } = await supabase
            .from("notification_logs")
            .insert({
              recipient_email: email,
              notification_type: "email",
              event_type: `milestone_${milestone.milestone_type}`,
              payload: {
                person: `${milestone.first_name} ${milestone.last_name}`,
                milestone_type: milestone.milestone_type,
                years: milestone.years,
              },
              status: "pending",
              attempts: 0,
              next_retry_at: new Date().toISOString(),
            })
            .select()
            .single();

          if (logError) {
            console.error("Failed to create notification log:", logError);
            emailResults.push({ target: email, success: false, error: String(logError) });
            continue;
          }

          // Rate limit: max 2 per second
          if (i > 0 && i % 2 === 0) {
            await new Promise((r) => setTimeout(r, 1100));
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
                to: [email],
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
                attempts: 1,
                last_attempt_at: new Date().toISOString(),
                next_retry_at: null,
                updated_at: new Date().toISOString(),
              })
              .eq("id", logEntry.id);

            emailResults.push({ target: email, success: true });
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            console.error(`Email to ${email} failed:`, errorMsg);

            await supabase
              .from("notification_logs")
              .update({
                status: "pending",
                attempts: 1,
                last_attempt_at: new Date().toISOString(),
                next_retry_at: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
                error_message: errorMsg,
                updated_at: new Date().toISOString(),
              })
              .eq("id", logEntry.id);

            emailResults.push({ target: email, success: false, error: errorMsg });
          }
        }
      }
    } else {
      console.log("RESEND_API_KEY not configured, skipping emails");
    }

    return new Response(
      JSON.stringify({
        message: "Milestone notifications created",
        milestones: milestones.length,
        notifications: notifications.length,
        emails_sent: emailResults.filter((r) => r.success).length,
        emails_failed: emailResults.filter((r) => !r.success).length,
        email_results: emailResults,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in check-milestones function:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ===== Email Templates =====

function buildMilestoneEmail(milestone: MilestoneRecord): { subject: string; html: string } {
  const fullName = `${milestone.first_name} ${milestone.last_name}`;

  if (milestone.milestone_type === "birthday") {
    return {
      subject: `🎂 Happy Birthday ${fullName}! 🎉`,
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family:Arial,sans-serif;background:#f4f5f7;padding:20px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:40px;box-shadow:0 2px 12px rgba(0,0,0,0.08);text-align:center;">
    <div style="font-size:64px;margin-bottom:16px;">🎂</div>
    <h1 style="color:#1a1a2e;margin:0 0 8px;font-size:28px;">Happy Birthday!</h1>
    <h2 style="color:#6366f1;margin:0 0 16px;font-size:22px;">${fullName}</h2>
    <div style="background:linear-gradient(135deg,#fef3c7,#fde68a);border-radius:8px;padding:24px;margin:20px 0;">
      <p style="color:#92400e;font-size:16px;margin:0;line-height:1.6;">
        🎉 Today is a special day! Let's come together to wish <strong>${milestone.first_name}</strong> 
        a wonderful birthday filled with joy, laughter, and happiness!
      </p>
    </div>
    <p style="color:#666;font-size:15px;line-height:1.6;margin:16px 0;">
      Please take a moment to send your warm wishes to ${milestone.first_name}. 
      A kind word can truly brighten someone's day! 💛
    </p>
    <a href="https://hrm-focus.lovable.app/notifications" 
       style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:12px;">
      Send Birthday Wishes 🎈
    </a>
    <p style="color:#999;font-size:12px;margin-top:32px;">This is an automated celebration from HRM Focus.</p>
  </div>
</body>
</html>`,
    };
  } else {
    const yearsText = milestone.years === 1 ? "1 year" : `${milestone.years} years`;
    const ordinal = getOrdinal(milestone.years);

    return {
      subject: `🎊 Congratulations ${fullName} — ${ordinal} Work Anniversary! 🎉`,
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family:Arial,sans-serif;background:#f4f5f7;padding:20px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:40px;box-shadow:0 2px 12px rgba(0,0,0,0.08);text-align:center;">
    <div style="font-size:64px;margin-bottom:16px;">🎊</div>
    <h1 style="color:#1a1a2e;margin:0 0 8px;font-size:28px;">Work Anniversary!</h1>
    <h2 style="color:#059669;margin:0 0 16px;font-size:22px;">${fullName}</h2>
    <div style="background:linear-gradient(135deg,#d1fae5,#a7f3d0);border-radius:8px;padding:24px;margin:20px 0;">
      <p style="color:#065f46;font-size:20px;font-weight:700;margin:0 0 8px;">${yearsText} 🏆</p>
      <p style="color:#065f46;font-size:16px;margin:0;line-height:1.6;">
        Today marks <strong>${milestone.first_name}</strong>'s ${ordinal} anniversary with the company! 
        Their dedication and hard work have been invaluable to our team.
      </p>
    </div>
    <p style="color:#666;font-size:15px;line-height:1.6;margin:16px 0;">
      Let's celebrate ${milestone.first_name}'s journey with us! 
      Drop a congratulatory message to show your appreciation. 🙌
    </p>
    <a href="https://hrm-focus.lovable.app/notifications" 
       style="display:inline-block;background:linear-gradient(135deg,#059669,#10b981);color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:12px;">
      Congratulate ${milestone.first_name} 🎉
    </a>
    <p style="color:#999;font-size:12px;margin-top:32px;">This is an automated celebration from HRM Focus.</p>
  </div>
</body>
</html>`,
    };
  }
}

function getOrdinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
