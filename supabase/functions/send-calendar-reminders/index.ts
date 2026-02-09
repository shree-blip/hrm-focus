import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify cron secret
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
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) {
      console.error("RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(resendApiKey);

    // Get tomorrow's date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];

    console.log(`Checking for events on ${tomorrowStr}`);

    // 1. Fetch custom calendar events for tomorrow that haven't had reminders sent
    const { data: customEvents, error: eventsError } = await supabase
      .from("calendar_events")
      .select("*")
      .eq("event_date", tomorrowStr)
      .eq("is_active", true)
      .eq("reminder_sent", false);

    if (eventsError) {
      console.error("Error fetching calendar events:", eventsError);
      throw eventsError;
    }

    console.log(`Found ${customEvents?.length || 0} custom events for tomorrow`);

    // 2. Get all active user emails
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("user_id, email, first_name, last_name")
      .not("email", "is", null);

    if (profilesError) {
      console.error("Error fetching profiles:", profilesError);
      throw profilesError;
    }

    const allEmails = profiles?.map((p) => p.email).filter(Boolean) || [];
    console.log(`Found ${allEmails.length} users to notify`);

    if (allEmails.length === 0 || (!customEvents || customEvents.length === 0)) {
      console.log("No events or no users to notify");
      return new Response(
        JSON.stringify({ message: "No reminders to send", count: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let emailsSent = 0;
    const formattedDate = tomorrow.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    // Build combined email for all events tomorrow
    const eventsList = customEvents
      .map((event) => {
        const typeEmoji =
          event.event_type === "deadline" ? "⏰" :
          event.event_type === "reminder" ? "🔔" : "📅";
        const typeLabel =
          event.event_type === "deadline" ? "Deadline" :
          event.event_type === "reminder" ? "Reminder" : "Event";
        return `
          <tr>
            <td style="padding: 12px 16px; border-bottom: 1px solid #eee;">
              <div style="font-size: 16px; font-weight: 600; color: #333;">
                ${typeEmoji} ${event.title}
              </div>
              ${event.description ? `<div style="font-size: 14px; color: #666; margin-top: 4px;">${event.description}</div>` : ""}
              <div style="font-size: 12px; color: #999; margin-top: 4px;">Type: ${typeLabel}</div>
            </td>
          </tr>`;
      })
      .join("");

    // Send batch emails (Resend supports up to 100 recipients)
    const batchSize = 50;
    for (let i = 0; i < allEmails.length; i += batchSize) {
      const batch = allEmails.slice(i, i + batchSize);

      for (const email of batch) {
        try {
          const { error: sendError } = await resend.emails.send({
            from: "Focus Your Finance <hello@focusyourfinance.com>",
            to: [email],
            subject: `📋 Upcoming: ${customEvents.length} event${customEvents.length > 1 ? "s" : ""} tomorrow – ${formattedDate}`,
            html: `
              <!DOCTYPE html>
              <html>
              <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
              </head>
              <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f9fafb; margin: 0; padding: 0;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                  <div style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                    <!-- Header -->
                    <div style="background: linear-gradient(135deg, #1e40af, #3b82f6); padding: 24px 24px; text-align: center;">
                      <h1 style="color: #ffffff; font-size: 22px; margin: 0;">📅 Calendar Reminder</h1>
                      <p style="color: #bfdbfe; font-size: 14px; margin: 8px 0 0 0;">
                        ${formattedDate}
                      </p>
                    </div>
                    
                    <!-- Content -->
                    <div style="padding: 24px;">
                      <p style="color: #374151; font-size: 15px; margin: 0 0 16px 0;">
                        Hello! Here's a reminder about upcoming events scheduled for <strong>tomorrow</strong>:
                      </p>
                      
                      <table style="width: 100%; border-collapse: collapse; background-color: #f9fafb; border-radius: 8px; overflow: hidden;">
                        ${eventsList}
                      </table>
                      
                      <p style="color: #6b7280; font-size: 13px; margin: 20px 0 0 0; text-align: center;">
                        Please prepare accordingly. This is an automated reminder from Focus Your Finance HRM.
                      </p>
                    </div>
                    
                    <!-- Footer -->
                    <div style="background-color: #f3f4f6; padding: 16px 24px; text-align: center;">
                      <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                        Focus Your Finance • Company Calendar Notifications
                      </p>
                    </div>
                  </div>
                </div>
              </body>
              </html>
            `,
          });

          if (sendError) {
            console.error(`Failed to send email to ${email}:`, sendError);
          } else {
            emailsSent++;
          }
        } catch (emailErr) {
          console.error(`Error sending email to ${email}:`, emailErr);
        }
      }
    }

    // Mark events as reminder_sent
    const eventIds = customEvents.map((e) => e.id);
    if (eventIds.length > 0) {
      const { error: updateError } = await supabase
        .from("calendar_events")
        .update({ reminder_sent: true })
        .in("id", eventIds);

      if (updateError) {
        console.error("Error updating reminder_sent:", updateError);
      }
    }

    // Also create in-app notifications
    const notifications = [];
    for (const event of customEvents) {
      for (const profile of profiles || []) {
        const typeEmoji =
          event.event_type === "deadline" ? "⏰" :
          event.event_type === "reminder" ? "🔔" : "📅";
        notifications.push({
          user_id: profile.user_id,
          title: `${typeEmoji} Tomorrow: ${event.title}`,
          message: event.description || `You have a ${event.event_type} scheduled for tomorrow.`,
          type: "info",
          link: "/",
        });
      }
    }

    // Insert notifications in batches
    if (notifications.length > 0) {
      const notifBatchSize = 100;
      for (let i = 0; i < notifications.length; i += notifBatchSize) {
        const batch = notifications.slice(i, i + notifBatchSize);
        const { error: notifError } = await supabase
          .from("notifications")
          .insert(batch);
        if (notifError) {
          console.error("Error inserting notifications:", notifError);
        }
      }
    }

    console.log(`Successfully sent ${emailsSent} reminder emails for ${customEvents.length} events`);

    return new Response(
      JSON.stringify({
        message: "Calendar reminders sent",
        events: customEvents.length,
        emails_sent: emailsSent,
        notifications: notifications.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in send-calendar-reminders:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
