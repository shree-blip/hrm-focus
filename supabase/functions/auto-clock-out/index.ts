import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = resendApiKey ? new Resend(resendApiKey) : null;

    // Get current time
    const now = new Date();
    const eightHoursAgo = new Date(now.getTime() - 8 * 60 * 60 * 1000);

    console.log(`Running auto clock-out check at ${now.toISOString()}`);
    console.log(`Looking for logs clocked in before ${eightHoursAgo.toISOString()}`);

    // Find all users who need to be auto clocked out
    // They have clocked in more than 8 hours ago and haven't clocked out
    const { data: overdueAttendance, error: fetchError } = await supabase
      .from("attendance_logs")
      .select(`
        id,
        user_id,
        employee_id,
        clock_in,
        employees!attendance_logs_employee_id_fkey (
          first_name,
          last_name,
          email
        )
      `)
      .is("clock_out", null)
      .neq("status", "auto_clocked_out")
      .lt("clock_in", eightHoursAgo.toISOString());

    if (fetchError) {
      console.error("Error fetching overdue attendance:", fetchError);
      throw fetchError;
    }

    console.log(`Found ${overdueAttendance?.length || 0} users to auto clock-out`);

    const results = [];
    
    for (const log of overdueAttendance || []) {
      // Calculate exact 8 hours from clock in
      const clockInTime = new Date(log.clock_in);
      const clockOutTime = new Date(clockInTime.getTime() + 8 * 60 * 60 * 1000);
      
      console.log(`Processing log ${log.id}: clocked in at ${log.clock_in}, auto clock out at ${clockOutTime.toISOString()}`);
      
      // Auto clock out at exactly 8 hours after clock in
      const { error: updateError } = await supabase
        .from("attendance_logs")
        .update({
          clock_out: clockOutTime.toISOString(),
          notes: "[Auto clocked out after 8 hours]",
          status: "auto_clocked_out"
        })
        .eq("id", log.id);

      if (updateError) {
        console.error(`Error updating log ${log.id}:`, updateError);
        continue;
      }

      // Get employee info - handle both array and object responses
      const employeeData = log.employees as unknown;
      let employee: { first_name: string; last_name: string; email: string } | null = null;
      
      if (Array.isArray(employeeData) && employeeData.length > 0) {
        employee = employeeData[0] as { first_name: string; last_name: string; email: string };
      } else if (employeeData && typeof employeeData === 'object' && employeeData !== null) {
        const empObj = employeeData as Record<string, unknown>;
        if ('email' in empObj && 'first_name' in empObj && 'last_name' in empObj) {
          employee = {
            first_name: String(empObj.first_name),
            last_name: String(empObj.last_name),
            email: String(empObj.email)
          };
        }
      }

      // Create notification for the user
      if (log.user_id) {
        const { error: notifError } = await supabase
          .from("notifications")
          .insert({
            user_id: log.user_id,
            title: "Auto Clock Out",
            message: "You were automatically clocked out after 8 hours of work. If you are still working, please clock in again.",
            type: "warning",
            link: "/attendance"
          });
          
        if (notifError) {
          console.error(`Error creating notification for user ${log.user_id}:`, notifError);
        }
      }

      // Send email if Resend is configured and employee has email
      let emailSent = false;
      if (resend && employee?.email) {
        try {
          const emailResult = await resend.emails.send({
            from: "Focus Your Finance <onboarding@resend.dev>",
            to: [employee.email],
            subject: "Auto Clock Out Notification",
            html: `
              <!DOCTYPE html>
              <html>
              <head>
                <style>
                  body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                  .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                  .header { background-color: #1a365d; color: white; padding: 20px; text-align: center; }
                  .content { padding: 20px; background-color: #f8f9fa; }
                  .info-box { background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
                  .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="header">
                    <h1>Auto Clock Out Notice</h1>
                  </div>
                  <div class="content">
                    <p>Hello ${employee.first_name} ${employee.last_name},</p>
                    <p>You were automatically clocked out after completing <strong>8 hours</strong> of continuous work.</p>
                    <div class="info-box">
                      <p><strong>Clock In:</strong> ${clockInTime.toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}</p>
                      <p><strong>Auto Clock Out:</strong> ${clockOutTime.toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}</p>
                      <p><strong>Total Hours:</strong> 8 hours</p>
                    </div>
                    <p>If you are still working, please log back into the HR system and clock in again.</p>
                    <p>Best regards,<br>Focus Your Finance HR Team</p>
                  </div>
                  <div class="footer">
                    <p>This is an automated message from Focus Your Finance HR System</p>
                  </div>
                </div>
              </body>
              </html>
            `,
          });
          console.log(`Email sent to ${employee.email}:`, emailResult);
          emailSent = true;
        } catch (emailError) {
          console.error(`Failed to send email to ${employee.email}:`, emailError);
        }
      } else {
        console.log(`Skipping email: resend configured: ${!!resend}, employee email: ${employee?.email || 'none'}`);
      }

      results.push({
        log_id: log.id,
        user_id: log.user_id,
        employee_id: log.employee_id,
        employee_name: employee ? `${employee.first_name} ${employee.last_name}` : 'Unknown',
        employee_email: employee?.email || 'none',
        clock_in: log.clock_in,
        clock_out: clockOutTime.toISOString(),
        email_sent: emailSent,
        notification_created: !!log.user_id
      });
    }

    console.log(`Auto clock-out completed. Affected users: ${results.length}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        affected_count: results.length,
        results,
        message: `${results.length} user(s) were auto clocked out`,
        timestamp: now.toISOString()
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200 
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in auto-clock-out function:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500 
      }
    );
  }
});
