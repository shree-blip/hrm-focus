import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface MilestoneRecord {
  user_id: string;
  first_name: string;
  last_name: string;
  milestone_type: string;
  years: number;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify cron secret for scheduled calls
    const authHeader = req.headers.get("Authorization");
    const cronSecret = Deno.env.get("CRON_SECRET");
    
    // Allow both cron secret and regular auth
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

    // Get today's milestones using the database function
    const { data: milestones, error: milestonesError } = await supabase.rpc(
      "get_todays_milestones"
    );

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

    // Get all user IDs to notify (all active users)
    const { data: allProfiles, error: profilesError } = await supabase
      .from("profiles")
      .select("user_id")
      .not("user_id", "is", null);

    if (profilesError) {
      console.error("Error fetching profiles:", profilesError);
      throw profilesError;
    }

    const allUserIds = allProfiles?.map((p) => p.user_id) || [];
    console.log(`Found ${allUserIds.length} users to notify`);

    // Create notifications for each milestone
    const notifications: {
      user_id: string;
      title: string;
      message: string;
      type: string;
      link: string;
    }[] = [];

    for (const milestone of milestones as MilestoneRecord[]) {
      const isOwnMilestone = (userId: string) => userId === milestone.user_id;
      
      for (const userId of allUserIds) {
        // Don't notify the person about their own birthday/anniversary
        if (isOwnMilestone(userId)) continue;

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

        notifications.push({
          user_id: userId,
          title,
          message,
          type: "celebration",
          link: "/notifications",
        });
      }
    }

    console.log(`Creating ${notifications.length} notifications`);

    // Insert notifications in batches
    if (notifications.length > 0) {
      const batchSize = 100;
      for (let i = 0; i < notifications.length; i += batchSize) {
        const batch = notifications.slice(i, i + batchSize);
        const { error: insertError } = await supabase
          .from("notifications")
          .insert(batch);

        if (insertError) {
          console.error("Error inserting notifications batch:", insertError);
        }
      }
    }

    return new Response(
      JSON.stringify({
        message: "Milestone notifications created",
        milestones: milestones.length,
        notifications: notifications.length,
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
