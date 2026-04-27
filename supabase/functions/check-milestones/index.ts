import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

interface ProfileRecord {
  user_id: string;
  email: string | null;
  first_name?: string | null;
  last_name?: string | null;
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
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // =========================================================
    // 1. FETCH MILESTONES FOR 3 TIMINGS
    // Assumes you create RPCs like:
    // - get_milestones_in_days(days_ahead int)
    // or equivalent DB functions.
    // =========================================================

    // 15 days ahead → admin/CEO planning notice
    const { data: milestones15, error: error15 } = await supabase.rpc("get_milestones_in_days", {
      days_ahead: 15,
    });

    const { data: milestones1, error: error1 } = await supabase.rpc("get_milestones_in_days", {
      days_ahead: 1,
    });

    const { data: milestonesToday, error: errorToday } = await supabase.rpc("get_milestones_in_days", {
      days_ahead: 0,
    });

    if (error15) throw error15;
    if (error1) throw error1;
    if (errorToday) throw errorToday;

    // =========================================================
    // 2. FETCH ALL PROFILES
    // =========================================================

    const { data: allProfiles, error: profilesError } = await supabase
      .from("profiles")
      .select("user_id, email, first_name, last_name")
      .not("user_id", "is", null);

    if (profilesError) {
      console.error("Error fetching profiles:", profilesError);
      throw profilesError;
    }

    const profiles = (allProfiles || []) as ProfileRecord[];
    const allUserIds = profiles.map((p) => p.user_id);
    const allEmails = profiles.filter((p) => p.email).map((p) => p.email!) || [];

    // =========================================================
    // 3. FETCH ADMIN + CEO USERS
    // =========================================================

    // CEO is stored as the 'vp' role internally
    const { data: privilegedUsers, error: privilegedError } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .in("role", ["admin", "vp"]);

    if (privilegedError) {
      console.error("Error fetching admin/ceo users:", privilegedError);
      throw privilegedError;
    }

    const privilegedUserIds = [...new Set((privilegedUsers || []).map((u) => u.user_id))];

    const privilegedEmails =
      profiles.filter((p) => privilegedUserIds.includes(p.user_id) && p.email).map((p) => p.email!) || [];

    // =========================================================
    // 4. HELPERS
    // =========================================================

    const notificationResults: Array<{ type: string; target: string; success: boolean; error?: string }> = [];

    async function createInAppNotification(userId: string, title: string, message: string) {
      try {
        const { error } = await supabase.rpc("create_notification", {
          p_user_id: userId,
          p_title: title,
          p_message: message,
          p_type: "info",
          p_link: "/notifications",
        });

        if (error) throw error;

        notificationResults.push({ type: "in_app", target: userId, success: true });
      } catch (err) {
        console.error(`Failed in-app notification for ${userId}:`, err);
        notificationResults.push({
          type: "in_app",
          target: userId,
          success: false,
          error: String(err),
        });
      }
    }

    async function alreadySent(eventType: string, recipientEmail: string, milestone: MilestoneRecord, yearTag: number) {
      const { data, error } = await supabase
        .from("notification_logs")
        .select("id")
        .eq("notification_type", "email")
        .eq("event_type", eventType)
        .eq("recipient_email", recipientEmail)
        .contains("payload", {
          milestone_user_id: milestone.user_id,
          milestone_type: milestone.milestone_type,
          milestone_year: yearTag,
        })
        .limit(1);

      if (error) {
        console.error("Error checking duplicate milestone email:", error);
        return false;
      }

      return !!(data && data.length > 0);
    }

    async function sendMilestoneEmail(
      recipientEmail: string,
      eventType: string,
      subject: string,
      html: string,
      payload: Record<string, unknown>,
    ) {
      const duplicate = await alreadySent(
        eventType,
        recipientEmail,
        payload.milestone as MilestoneRecord,
        payload.milestone_year as number,
      );

      if (duplicate) {
        console.log(`Skipping duplicate ${eventType} email to ${recipientEmail}`);
        return;
      }

      const { data: logEntry, error: logError } = await supabase
        .from("notification_logs")
        .insert({
          recipient_email: recipientEmail,
          notification_type: "email",
          event_type: eventType,
          payload,
          status: "pending",
          attempts: 0,
          next_retry_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (logError) {
        console.error("Failed to create notification log:", logError);
        notificationResults.push({
          type: "email",
          target: recipientEmail,
          success: false,
          error: String(logError),
        });
        return;
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
            to: [recipientEmail],
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

        notificationResults.push({
          type: "email",
          target: recipientEmail,
          success: true,
        });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error(`Email to ${recipientEmail} failed:`, errorMsg);

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

        notificationResults.push({
          type: "email",
          target: recipientEmail,
          success: false,
          error: errorMsg,
        });
      }
    }

    async function processMilestones(milestones: MilestoneRecord[], phase: "early_15" | "pre_1" | "today") {
      const currentYear = new Date().getFullYear();

      for (const milestone of milestones || []) {
        const fullName = `${milestone.first_name} ${milestone.last_name}`;

        let inAppTitle = "";
        let inAppMessage = "";

        if (phase === "early_15") {
          if (milestone.milestone_type === "birthday") {
            inAppTitle = `📅 Upcoming Birthday`;
            inAppMessage = `${fullName}'s birthday is in 15 days. Please plan accordingly.`;
          } else {
            const yearsText = milestone.years === 1 ? "1 year" : `${milestone.years} years`;
            inAppTitle = `📅 Upcoming Work Anniversary`;
            inAppMessage = `${fullName}'s ${yearsText} work anniversary is in 15 days. Please plan accordingly.`;
          }

          // Admin + CEO only
          for (const userId of privilegedUserIds) {
            if (userId === milestone.user_id) continue;
            await createInAppNotification(userId, inAppTitle, inAppMessage);
          }

          if (RESEND_API_KEY) {
            const recipients = [...new Set([...privilegedEmails, FIXED_CC_EMAIL])];

            const { subject, html } = buildPlanningMilestoneEmail(milestone);

            for (const email of recipients) {
              await sendMilestoneEmail(email, `milestone_15day_${milestone.milestone_type}`, subject, html, {
                milestone,
                milestone_user_id: milestone.user_id,
                milestone_type: milestone.milestone_type,
                milestone_year: currentYear,
                phase: "15_days_before",
                person: fullName,
                years: milestone.years,
              });
            }
          }
        } else if (phase === "pre_1") {
          if (milestone.milestone_type === "birthday") {
            inAppTitle = `🎉 Birthday Tomorrow`;
            inAppMessage = `${fullName}'s birthday is tomorrow! Don't forget to wish them.`;
          } else {
            const yearsText = milestone.years === 1 ? "1 year" : `${milestone.years} years`;
            inAppTitle = `🎉 Work Anniversary Tomorrow`;
            inAppMessage = `${fullName}'s ${yearsText} work anniversary is tomorrow!`;
          }

          // Admin + CEO + everyone except the milestone person
          for (const userId of allUserIds) {
            if (userId === milestone.user_id) continue;
            await createInAppNotification(userId, inAppTitle, inAppMessage);
          }

          if (RESEND_API_KEY) {
            const teamEmailsExceptSelf = allEmails.filter((e) => {
              const profile = profiles.find((p) => p.email === e);
              return profile?.user_id !== milestone.user_id;
            });

            const recipients = [...new Set([...teamEmailsExceptSelf, FIXED_CC_EMAIL])];
            const { subject, html } = buildTomorrowMilestoneEmail(milestone);

            for (const email of recipients) {
              await sendMilestoneEmail(email, `milestone_1day_${milestone.milestone_type}`, subject, html, {
                milestone,
                milestone_user_id: milestone.user_id,
                milestone_type: milestone.milestone_type,
                milestone_year: currentYear,
                phase: "1_day_before",
                person: fullName,
                years: milestone.years,
              });
            }
          }
        } else if (phase === "today") {
          if (milestone.milestone_type === "birthday") {
            inAppTitle = `🎂 Birthday Celebration!`;
            inAppMessage = `Today is ${fullName}'s birthday! Wish them a happy birthday! 🎉`;
          } else {
            const yearsText = milestone.years === 1 ? "1 year" : `${milestone.years} years`;
            inAppTitle = `🎊 Work Anniversary!`;
            inAppMessage = `${fullName} celebrates ${yearsText} with the company today! Congratulations! 🎉`;
          }

          // everyone except the milestone person
          for (const userId of allUserIds) {
            if (userId === milestone.user_id) continue;
            await createInAppNotification(userId, inAppTitle, inAppMessage);
          }

          if (RESEND_API_KEY) {
            const teamEmailsExceptSelf = allEmails.filter((e) => {
              const profile = profiles.find((p) => p.email === e);
              return profile?.user_id !== milestone.user_id;
            });

            const recipients = [...new Set([...teamEmailsExceptSelf, FIXED_CC_EMAIL])];
            const { subject, html } = buildTodayMilestoneEmail(milestone);

            for (const email of recipients) {
              await sendMilestoneEmail(email, `milestone_today_${milestone.milestone_type}`, subject, html, {
                milestone,
                milestone_user_id: milestone.user_id,
                milestone_type: milestone.milestone_type,
                milestone_year: currentYear,
                phase: "today",
                person: fullName,
                years: milestone.years,
              });
            }
          }
        }
      }
    }

    // =========================================================
    // 5. PROCESS ALL PHASES
    // =========================================================

    await processMilestones((milestones15 || []) as MilestoneRecord[], "early_15");
    await processMilestones((milestones1 || []) as MilestoneRecord[], "pre_1");
    await processMilestones((milestonesToday || []) as MilestoneRecord[], "today");

    return new Response(
      JSON.stringify({
        success: true,
        milestones_15_days: (milestones15 || []).length,
        milestones_1_day: (milestones1 || []).length,
        milestones_today: (milestonesToday || []).length,
        results: notificationResults,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in milestone notification function:", error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ===================== EMAIL TEMPLATES =====================

function buildPlanningMilestoneEmail(milestone: MilestoneRecord): { subject: string; html: string } {
  const fullName = `${milestone.first_name} ${milestone.last_name}`;

  if (milestone.milestone_type === "birthday") {
    return {
      subject: `📅 Upcoming Birthday in 15 Days - ${fullName}`,
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family:Arial,sans-serif;background:#f4f5f7;padding:20px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
    <h2 style="color:#1a1a2e;margin-top:0;">📅 Upcoming Birthday</h2>
    <p style="color:#333;">This is an early planning reminder.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <tr><td style="padding:8px 0;color:#666;width:180px;">Employee</td><td style="padding:8px 0;font-weight:600;">${fullName}</td></tr>
      <tr><td style="padding:8px 0;color:#666;">Milestone</td><td style="padding:8px 0;">Birthday</td></tr>
      <tr><td style="padding:8px 0;color:#666;">Timing</td><td style="padding:8px 0;">15 days before</td></tr>
    </table>
    <p style="color:#666;">Please plan recognition or celebration in advance.</p>
  </div>
</body>
</html>`,
    };
  }

  const yearsText = milestone.years === 1 ? "1 year" : `${milestone.years} years`;
  return {
    subject: `📅 Upcoming Work Anniversary in 15 Days - ${fullName}`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family:Arial,sans-serif;background:#f4f5f7;padding:20px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
    <h2 style="color:#1a1a2e;margin-top:0;">📅 Upcoming Work Anniversary</h2>
    <p style="color:#333;">This is an early planning reminder.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <tr><td style="padding:8px 0;color:#666;width:180px;">Employee</td><td style="padding:8px 0;font-weight:600;">${fullName}</td></tr>
      <tr><td style="padding:8px 0;color:#666;">Milestone</td><td style="padding:8px 0;">Work Anniversary</td></tr>
      <tr><td style="padding:8px 0;color:#666;">Years</td><td style="padding:8px 0;font-weight:600;">${yearsText}</td></tr>
      <tr><td style="padding:8px 0;color:#666;">Timing</td><td style="padding:8px 0;">15 days before</td></tr>
    </table>
    <p style="color:#666;">Please plan recognition or celebration in advance.</p>
  </div>
</body>
</html>`,
  };
}

function buildTomorrowMilestoneEmail(milestone: MilestoneRecord): { subject: string; html: string } {
  const fullName = `${milestone.first_name} ${milestone.last_name}`;

  if (milestone.milestone_type === "birthday") {
    return {
      subject: `🎉 Birthday Tomorrow - ${fullName}`,
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family:Arial,sans-serif;background:#f4f5f7;padding:20px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:40px;box-shadow:0 2px 12px rgba(0,0,0,0.08);text-align:center;">
    <div style="font-size:56px;margin-bottom:16px;">🎉</div>
    <h1 style="color:#1a1a2e;margin:0 0 8px;">Birthday Tomorrow</h1>
    <h2 style="color:#6366f1;margin:0 0 16px;">${fullName}</h2>
    <p style="color:#666;line-height:1.6;">
      ${milestone.first_name}'s birthday is tomorrow. Please don't forget to send your wishes and celebrate together.
    </p>
    <a href="https://hrm-focus.lovable.app/notifications"
       style="display:inline-block;background:#6366f1;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;margin-top:12px;">
      View Notifications
    </a>
  </div>
</body>
</html>`,
    };
  }

  const ordinal = getOrdinal(milestone.years);
  return {
    subject: `🎉 Work Anniversary Tomorrow - ${fullName}`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family:Arial,sans-serif;background:#f4f5f7;padding:20px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:40px;box-shadow:0 2px 12px rgba(0,0,0,0.08);text-align:center;">
    <div style="font-size:56px;margin-bottom:16px;">🎉</div>
    <h1 style="color:#1a1a2e;margin:0 0 8px;">Work Anniversary Tomorrow</h1>
    <h2 style="color:#059669;margin:0 0 16px;">${fullName}</h2>
    <p style="color:#666;line-height:1.6;">
      Tomorrow marks ${milestone.first_name}'s ${ordinal} work anniversary. Please remember to congratulate them.
    </p>
    <a href="https://hrm-focus.lovable.app/notifications"
       style="display:inline-block;background:#059669;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;margin-top:12px;">
      View Notifications
    </a>
  </div>
</body>
</html>`,
  };
}

function buildTodayMilestoneEmail(milestone: MilestoneRecord): { subject: string; html: string } {
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
  }

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
      </p>
    </div>
    <p style="color:#666;font-size:15px;line-height:1.6;margin:16px 0;">
      Let's celebrate ${milestone.first_name}'s journey with us!
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

function getOrdinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
