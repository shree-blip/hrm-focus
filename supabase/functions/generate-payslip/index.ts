import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (!roles || (roles.role !== "vp" && roles.role !== "admin")) {
      return new Response(
        JSON.stringify({ error: "Access denied. VP or Admin role required." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { employee_id, period_type, year, month, quarter, gross_pay, net_pay, deductions, hours_worked } = await req.json();

    const { data: employee, error: empError } = await supabase
      .from("employees")
      .select("*")
      .eq("id", employee_id)
      .single();

    if (empError || !employee) {
      return new Response(
        JSON.stringify({ error: "Employee not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("id", employee.profile_id)
      .single();

    let periodStart: string;
    let periodEnd: string;
    
    if (period_type === "monthly") {
      periodStart = `${year}-${String(month).padStart(2, "0")}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      periodEnd = `${year}-${String(month).padStart(2, "0")}-${lastDay}`;
    } else if (period_type === "quarterly") {
      const startMonth = (quarter - 1) * 3 + 1;
      const endMonth = quarter * 3;
      periodStart = `${year}-${String(startMonth).padStart(2, "0")}-01`;
      const lastDay = new Date(year, endMonth, 0).getDate();
      periodEnd = `${year}-${String(endMonth).padStart(2, "0")}-${lastDay}`;
    } else {
      periodStart = `${year}-01-01`;
      periodEnd = `${year}-12-31`;
    }

    const employeeName = `${employee.first_name} ${employee.last_name}`;
    const currencySymbol = employee.location === "US" ? "$" : "Rs.";
    const totalDeductions = Object.values(deductions || {}).reduce((a: number, b: number) => a + (b as number), 0);

    const pdfContent = `FOCUS YOUR FINANCE - PAYSLIP

Employee: ${employeeName}
ID: ${employee.employee_id || employee.id}
Department: ${employee.department || "N/A"}
Period: ${periodStart} to ${periodEnd}

Gross Pay: ${currencySymbol}${gross_pay?.toFixed(2) || "0.00"}
Deductions: ${currencySymbol}${totalDeductions.toFixed(2)}
Net Pay: ${currencySymbol}${net_pay?.toFixed(2) || "0.00"}
Hours: ${hours_worked || 0}

Generated: ${new Date().toISOString().split("T")[0]}`;

    const employeeFileName = `${employee.first_name}_${employee.last_name}`.replace(/\s+/g, "_");
    let fileName: string;
    if (period_type === "monthly") {
      fileName = `${employeeFileName}_${year}_${String(month).padStart(2, "0")}.pdf`;
    } else if (period_type === "quarterly") {
      fileName = `${employeeFileName}_${year}_Q${quarter}.pdf`;
    } else {
      fileName = `${employeeFileName}_${year}.pdf`;
    }

    const filePath = `${profile?.user_id || employee.id}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("payslips")
      .upload(filePath, new TextEncoder().encode(pdfContent), {
        contentType: "text/plain",
        upsert: true,
      });

    if (uploadError) {
      return new Response(
        JSON.stringify({ error: `Upload failed: ${uploadError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { error: insertError } = await supabase
      .from("payslip_files")
      .upsert({
        user_id: profile?.user_id || user.id,
        employee_id,
        period_type,
        year,
        month: period_type === "monthly" ? month : null,
        quarter: period_type === "quarterly" ? quarter : null,
        period_start: periodStart,
        period_end: periodEnd,
        file_path: filePath,
        file_name: fileName,
      });

    if (insertError) {
      console.error("Insert error:", insertError);
    }

    return new Response(
      JSON.stringify({ success: true, file_path: filePath, file_name: fileName }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error generating payslip:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
