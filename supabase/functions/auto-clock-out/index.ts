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

    // Find all users who need to be auto clocked out
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
      .lt("clock_in", new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString());

    if (fetchError) {
      console.error("Error fetching overdue attendance:", fetchError);
      throw fetchError;
    }

    console.log(`Found ${overdueAttendance?.length || 0} users to auto clock-out`);

    const results = [];
    
    for (const log of overdueAttendance || []) {
      const clockOutTime = new Date(new Date(log.clock_in).getTime() + 8 * 60 * 60 * 1000).toISOString();
      
      // Auto clock out
      const { error: updateError } = await supabase
        .from("attendance_logs")
        .update({
          clock_out: clockOutTime,
          notes: "[Auto clocked out after 8 hours]",
          status: "auto_clocked_out"
        })
        .eq("id", log.id);

      if (updateError) {
        console.error(`Error updating log ${log.id}:`, updateError);
        continue;
      }

      // Create notification
      await supabase
        .from("notifications")
        .insert({
          user_id: log.user_id,
          title: "Auto Clock Out",
          message: "You were automatically clocked out after 8 hours of work. If you are still working, please return to the dashboard and clock in again.",
          type: "warning",
          link: "/attendance"
        });

      // Send email if Resend is configured and employee has email
      const employees = log.employees as unknown as { first_name: string; last_name: string; email: string }[] | null;
      const employee = employees && employees.length > 0 ? employees[0] : null;
      if (resend && employee?.email) {
        try {
          await resend.emails.send({
            from: "HR System <onboarding@resend.dev>",
            to: [employee.email],
            subject: "You were automatically clocked out",
            html: `
              <h1>Hello ${employee.first_name} ${employee.last_name},</h1>
              <p>You were automatically clocked out after 8 hours of continuous work.</p>
              <p>Clock in time: ${new Date(log.clock_in).toLocaleString()}</p>
              <p>Auto clock out time: ${new Date(clockOutTime).toLocaleString()}</p>
              <p>If you are still working, please return to the HR dashboard and clock in again.</p>
              <p>Best regards,<br>HR System</p>
            `,
          });
          console.log(`Email sent to ${employee.email}`);
        } catch (emailError) {
          console.error(`Failed to send email to ${employee.email}:`, emailError);
        }
      }

      results.push({
        log_id: log.id,
        user_id: log.user_id,
        employee_name: employee ? `${employee.first_name} ${employee.last_name}` : 'Unknown',
        email_sent: !!(resend && employee?.email)
      });
    }

    console.log(`Auto clock-out completed. Affected users: ${results.length}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        affected_count: results.length,
        results,
        message: `${results.length} user(s) were auto clocked out`
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
