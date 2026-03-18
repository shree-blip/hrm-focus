import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get current user
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await anonClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;

    // Fetch user roles
    const { data: rolesData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const roles = (rolesData || []).map((r: any) => r.role as string);

    // Fetch user permissions (effective)
    const { data: permData } = await supabase.rpc("get_effective_permissions", { _user_id: userId });
    const perms: string[] = Array.isArray(permData) ? permData.map((p: any) => p.permission || p) : [];

    const isManagerPlus = roles.some((r: string) => ["admin", "vp", "manager", "supervisor", "line_manager"].includes(r));

    const badges: Record<string, number> = {};

    // Run all counts in parallel
    const today = new Date().toISOString().slice(0, 10);

    const queries: Promise<void>[] = [];

    // Leave: pending requests (managers see pending approvals, employees see their own pending)
    if (perms.includes("approve_leave")) {
      queries.push(
        supabase.from("leave_requests").select("id", { count: "exact", head: true }).eq("status", "pending")
          .then(({ count }) => { badges.leave = count || 0; })
      );
    } else if (perms.includes("view_leave")) {
      queries.push(
        supabase.from("leave_requests").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "pending")
          .then(({ count }) => { badges.leave = count || 0; })
      );
    }

    // Tasks: open tasks assigned to user
    if (perms.includes("manage_tasks") || perms.includes("view_tasks")) {
      queries.push(
        supabase.from("tasks").select("id", { count: "exact", head: true }).eq("assigned_to", userId).in("status", ["pending", "in_progress"])
          .then(({ count }) => { badges.tasks = count || 0; })
      );
    }

    // Announcements: active announcements
    if (perms.includes("view_announcements") || perms.includes("add_announcement")) {
      queries.push(
        supabase.from("announcements").select("id", { count: "exact", head: true }).eq("is_active", true)
          .then(({ count }) => { badges.announcements = count || 0; })
      );
    }

    // Documents: unread shared documents for user
    if (perms.includes("view_documents") || perms.includes("manage_documents")) {
      queries.push(
        supabase.from("document_shares").select("id", { count: "exact", head: true }).eq("recipient_id", userId).eq("is_read", false)
          .then(({ count }) => { badges.documents = count || 0; })
      );
    }

    // Invoices: pending invoices
    if (perms.includes("manage_invoices")) {
      queries.push(
        supabase.from("invoices").select("id", { count: "exact", head: true }).eq("status", "submitted")
          .then(({ count }) => { badges.invoices = count || 0; })
      );
    } else if (perms.includes("view_invoices")) {
      queries.push(
        supabase.from("invoices").select("id", { count: "exact", head: true }).eq("user_id", userId).in("status", ["submitted", "draft"])
          .then(({ count }) => { badges.invoices = count || 0; })
      );
    }

    // Loans: pending loan requests
    if (perms.includes("manage_loans")) {
      queries.push(
        supabase.from("loan_requests").select("id", { count: "exact", head: true }).in("status", ["pending", "manager_approved", "hr_reviewed"])
          .then(({ count }) => { badges.loans = count || 0; })
      );
    } else if (perms.includes("view_loans")) {
      queries.push(
        supabase.from("loan_requests").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "pending")
          .then(({ count }) => { badges.loans = count || 0; })
      );
    }

    // Support: open bug reports + grievances + asset requests
    if (perms.includes("manage_support") || perms.includes("view_support") || perms.includes("view_bug_reports") || perms.includes("view_grievances") || perms.includes("view_asset_requests")) {
      const supportQueries: Promise<number>[] = [];

      if (perms.includes("manage_support") || perms.includes("view_bug_reports")) {
        supportQueries.push(
          supabase.from("bug_reports").select("id", { count: "exact", head: true }).in("status", ["open", "in_progress"])
            .then(({ count }) => count || 0)
        );
      }
      if (perms.includes("manage_support") || perms.includes("view_grievances")) {
        supportQueries.push(
          supabase.from("grievances").select("id", { count: "exact", head: true }).in("status", ["open", "investigating"])
            .then(({ count }) => count || 0)
        );
      }
      if (perms.includes("manage_support") || perms.includes("view_asset_requests")) {
        supportQueries.push(
          supabase.from("asset_requests").select("id", { count: "exact", head: true }).eq("status", "pending")
            .then(({ count }) => count || 0)
        );
      }

      queries.push(
        Promise.all(supportQueries).then((counts) => {
          badges.support = counts.reduce((a, b) => a + b, 0);
        })
      );
    }

    // Attendance: pending adjustment requests for managers
    if (perms.includes("view_attendance_all") || perms.includes("edit_attendance")) {
      queries.push(
        supabase.from("attendance_adjustment_requests").select("id", { count: "exact", head: true }).eq("status", "pending")
          .then(({ count }) => { badges.attendance = count || 0; })
      );
    }

    // Log Sheet: no natural badge count - skip

    await Promise.all(queries);

    return new Response(JSON.stringify(badges), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
