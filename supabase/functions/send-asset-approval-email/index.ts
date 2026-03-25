import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      requestId,
      requestTitle,
      requestType,
      requestDescription,
      requestDate,
      employeeName,
      employeeEmail,
      department,
      lineManagerName,
      approvalDate,
    } = await req.json();

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const appUrl = SUPABASE_URL.replace(".supabase.co", "").includes("lovable")
      ? "https://hrm-focus.lovable.app"
      : "https://hrm-focus.lovable.app";

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #1a1a2e; border-bottom: 2px solid #e94560; padding-bottom: 10px;">
          🔔 Asset Request Approved by Line Manager – Action Required
        </h2>
        
        <p style="color: #555;">A new asset/IT support request has been approved by the Line Manager and requires your review.</p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr style="background: #f8f9fa;">
            <td style="padding: 10px; font-weight: bold; border: 1px solid #dee2e6;">Request Title</td>
            <td style="padding: 10px; border: 1px solid #dee2e6;">${requestTitle}</td>
          </tr>
          <tr>
            <td style="padding: 10px; font-weight: bold; border: 1px solid #dee2e6;">Request Type</td>
            <td style="padding: 10px; border: 1px solid #dee2e6;">${requestType === "it_support" ? "IT Support" : "Asset Request"}</td>
          </tr>
          <tr style="background: #f8f9fa;">
            <td style="padding: 10px; font-weight: bold; border: 1px solid #dee2e6;">Employee Name</td>
            <td style="padding: 10px; border: 1px solid #dee2e6;">${employeeName}</td>
          </tr>
          <tr>
            <td style="padding: 10px; font-weight: bold; border: 1px solid #dee2e6;">Employee Email</td>
            <td style="padding: 10px; border: 1px solid #dee2e6;">${employeeEmail}</td>
          </tr>
          <tr style="background: #f8f9fa;">
            <td style="padding: 10px; font-weight: bold; border: 1px solid #dee2e6;">Department</td>
            <td style="padding: 10px; border: 1px solid #dee2e6;">${department || "N/A"}</td>
          </tr>
          <tr>
            <td style="padding: 10px; font-weight: bold; border: 1px solid #dee2e6;">Description</td>
            <td style="padding: 10px; border: 1px solid #dee2e6;">${requestDescription}</td>
          </tr>
          <tr style="background: #f8f9fa;">
            <td style="padding: 10px; font-weight: bold; border: 1px solid #dee2e6;">Request Date</td>
            <td style="padding: 10px; border: 1px solid #dee2e6;">${requestDate}</td>
          </tr>
          <tr>
            <td style="padding: 10px; font-weight: bold; border: 1px solid #dee2e6;">Approved by LM</td>
            <td style="padding: 10px; border: 1px solid #dee2e6;">${lineManagerName}</td>
          </tr>
          <tr style="background: #f8f9fa;">
            <td style="padding: 10px; font-weight: bold; border: 1px solid #dee2e6;">LM Approval Date</td>
            <td style="padding: 10px; border: 1px solid #dee2e6;">${approvalDate}</td>
          </tr>
        </table>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${appUrl}/support" 
             style="background-color: #1a1a2e; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">
            Review Request
          </a>
        </div>
        
        <p style="color: #888; font-size: 12px; margin-top: 30px;">
          This is an automated email from Focus HRM. Please do not reply directly.
        </p>
      </div>
    `;

    // Get admin emails
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: adminUsers } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    const adminEmails: string[] = [];
    if (adminUsers && adminUsers.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("email")
        .in("user_id", adminUsers.map((u: any) => u.user_id));

      if (profiles) {
        adminEmails.push(...profiles.map((p: any) => p.email).filter(Boolean));
      }
    }

    // Also add VP emails as fallback
    const { data: vpUsers } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "vp");

    if (vpUsers && vpUsers.length > 0) {
      const { data: vpProfiles } = await supabaseAdmin
        .from("profiles")
        .select("email")
        .in("user_id", vpUsers.map((u: any) => u.user_id));

      if (vpProfiles) {
        adminEmails.push(...vpProfiles.map((p: any) => p.email).filter(Boolean));
      }
    }

    const uniqueEmails = [...new Set(adminEmails)];

    if (uniqueEmails.length === 0) {
      console.warn("No admin/VP emails found for notification");
      return new Response(JSON.stringify({ success: true, warning: "No admin emails found" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send email via Resend
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Focus HRM <noreply@notifications.focusyourfinance.com>",
        to: uniqueEmails,
        cc: ["hello@focusyourfinance.com"],
        subject: `New Asset Request Approved by Line Manager – Action Required: ${requestTitle}`,
        html: emailHtml,
      }),
    });

    const resData = await res.json();
    if (!res.ok) {
      throw new Error(`Resend API error: ${JSON.stringify(resData)}`);
    }

    // Create in-app notification for admins
    for (const adminUser of [...(adminUsers || []), ...(vpUsers || [])]) {
      await supabaseAdmin.rpc("create_notification", {
        p_user_id: adminUser.user_id,
        p_title: "Asset Request Needs Review",
        p_message: `${employeeName} submitted "${requestTitle}" – approved by LM ${lineManagerName}. Please review.`,
        p_type: "info",
        p_link: "/support",
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in send-asset-approval-email:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
