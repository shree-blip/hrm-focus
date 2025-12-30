import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as zip from "https://deno.land/x/zipjs@v2.7.32/index.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Get the auth token from request
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create client with user's token for RLS
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify user is VP or Admin
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check user role
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

    // Parse request body
    const { period_type, year, month, quarter, employee_ids } = await req.json();

    if (!period_type || !year) {
      return new Response(
        JSON.stringify({ error: "Missing required parameters: period_type, year" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build query for payslip files
    let query = supabase
      .from("payslip_files")
      .select("*, employees(first_name, last_name)")
      .eq("period_type", period_type)
      .eq("year", year);

    if (period_type === "monthly" && month) {
      query = query.eq("month", month);
    } else if (period_type === "quarterly" && quarter) {
      query = query.eq("quarter", quarter);
    }

    if (employee_ids && employee_ids.length > 0) {
      query = query.in("employee_id", employee_ids);
    }

    const { data: payslips, error: payslipsError } = await query;

    if (payslipsError) {
      return new Response(
        JSON.stringify({ error: payslipsError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!payslips || payslips.length === 0) {
      return new Response(
        JSON.stringify({ error: "No payslips found matching criteria" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create ZIP file using zip.js
    const blobWriter = new zip.BlobWriter("application/zip");
    const zipWriter = new zip.ZipWriter(blobWriter);

    // Download each file and add to ZIP
    for (const payslip of payslips) {
      const { data: fileData, error: fileError } = await supabase.storage
        .from("payslips")
        .download(payslip.file_path);

      if (fileError || !fileData) {
        console.error(`Failed to download ${payslip.file_path}:`, fileError);
        continue;
      }

      // Generate filename based on period type
      const employee = payslip.employees;
      const employeeName = employee 
        ? `${employee.first_name}_${employee.last_name}`.replace(/\s+/g, "_")
        : "Unknown";
      
      let fileName: string;
      if (period_type === "monthly") {
        const monthStr = String(payslip.month).padStart(2, "0");
        fileName = `${employeeName}_${year}_${monthStr}.pdf`;
      } else if (period_type === "quarterly") {
        fileName = `${employeeName}_${year}_Q${payslip.quarter}.pdf`;
      } else {
        fileName = `${employeeName}_${year}.pdf`;
      }

      await zipWriter.add(fileName, new zip.BlobReader(fileData));
    }

    await zipWriter.close();
    const zipBlob = await blobWriter.getData();
    const zipArrayBuffer = await zipBlob.arrayBuffer();

    // Generate download filename
    let downloadName = `payslips_${year}`;
    if (period_type === "monthly" && month) {
      downloadName += `_${String(month).padStart(2, "0")}`;
    } else if (period_type === "quarterly" && quarter) {
      downloadName += `_Q${quarter}`;
    }
    downloadName += ".zip";

    return new Response(zipArrayBuffer, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${downloadName}"`,
      },
    });
  } catch (error) {
    console.error("Error in bulk-payslip-download:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
