import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Validate JWT using anon client with user's token
    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;

    // Use service role client for data queries
    const supabase = createClient(supabaseUrl, serviceKey);

    // Fetch role + permissions in parallel
    const [rolePermsResult, overridesResult] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId).limit(1).single()
        .then(async ({ data: roleData }) => {
          if (!roleData) return { data: [] };
          return supabase.from("role_permissions").select("permission, enabled").eq("role", roleData.role);
        }),
      supabase.from("user_permission_overrides").select("permission, enabled").eq("user_id", userId),
    ]);

    // Build effective permission set
    const perms = new Set<string>();
    if (rolePermsResult.data) {
      for (const rp of rolePermsResult.data as any[]) {
        if (rp.enabled) perms.add(rp.permission);
      }
    }
    if (overridesResult.data) {
      for (const o of overridesResult.data as any[]) {
        if (o.enabled) {
          perms.add(o.permission);
        } else {
          perms.delete(o.permission);
        }
      }
    }

    const has = (p: string) => perms.has(p);
    const badges: Record<string, number> = {};
    const queries: Promise<void>[] = [];

    // Leave: pending
    if (has("approve_leave")) {
      queries.push(
        supabase.from("leave_requests").select("id", { count: "exact", head: true }).eq("status", "pending")
          .then(({ count }) => { badges.leave = count || 0; })
      );
    } else if (has("view_leave")) {
      queries.push(
        supabase.from("leave_requests").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "pending")
          .then(({ count }) => { badges.leave = count || 0; })
      );
    }

    // Tasks: open tasks assigned to user
    if (has("manage_tasks") || has("view_tasks")) {
      queries.push(
        (async () => {
          const { data: assignedTaskIds } = await supabase
            .from("task_assignees").select("task_id").eq("user_id", userId);
          if (assignedTaskIds && assignedTaskIds.length > 0) {
            const ids = assignedTaskIds.map((r: any) => r.task_id);
            const { count } = await supabase
              .from("tasks").select("id", { count: "exact", head: true })
              .in("id", ids).in("status", ["pending", "in_progress"]);
            badges.tasks = count || 0;
          } else {
            badges.tasks = 0;
          }
        })()
      );
    }

    // Announcements: active
    if (has("view_announcements") || has("add_announcement")) {
      queries.push(
        supabase.from("announcements").select("id", { count: "exact", head: true }).eq("is_active", true)
          .then(({ count }) => { badges.announcements = count || 0; })
      );
    }

    // Documents: unread shared
    if (has("view_documents") || has("manage_documents")) {
      queries.push(
        supabase.from("document_shares").select("id", { count: "exact", head: true }).eq("recipient_id", userId).eq("is_read", false)
          .then(({ count }) => { badges.documents = count || 0; })
      );
    }

    // Invoices
    if (has("manage_invoices")) {
      queries.push(
        supabase.from("invoices").select("id", { count: "exact", head: true }).eq("status", "submitted")
          .then(({ count }) => { badges.invoices = count || 0; })
      );
    } else if (has("view_invoices")) {
      queries.push(
        supabase.from("invoices").select("id", { count: "exact", head: true }).eq("user_id", userId).in("status", ["submitted", "draft"])
          .then(({ count }) => { badges.invoices = count || 0; })
      );
    }

    // Loans
    if (has("manage_loans")) {
      queries.push(
        supabase.from("loan_requests").select("id", { count: "exact", head: true }).in("status", ["pending", "manager_approved", "hr_reviewed"])
          .then(({ count }) => { badges.loans = count || 0; })
      );
    } else if (has("view_loans")) {
      queries.push(
        supabase.from("loan_requests").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "pending")
          .then(({ count }) => { badges.loans = count || 0; })
      );
    }

    // Support: aggregate
    if (has("manage_support") || has("view_support") || has("view_bug_reports") || has("view_grievances") || has("view_asset_requests")) {
      const supportCounts: Promise<number>[] = [];

      if (has("manage_support") || has("view_bug_reports")) {
        supportCounts.push(
          supabase.from("bug_reports").select("id", { count: "exact", head: true }).in("status", ["open", "in_progress"])
            .then(({ count }) => count || 0)
        );
      }
      if (has("manage_support") || has("view_grievances")) {
        supportCounts.push(
          supabase.from("grievances").select("id", { count: "exact", head: true }).in("status", ["open", "investigating"])
            .then(({ count }) => count || 0)
        );
      }
      if (has("manage_support") || has("view_asset_requests")) {
        supportCounts.push(
          supabase.from("asset_requests").select("id", { count: "exact", head: true }).eq("status", "pending")
            .then(({ count }) => count || 0)
        );
      }

      queries.push(
        Promise.all(supportCounts).then((counts) => {
          badges.support = counts.reduce((a, b) => a + b, 0);
        })
      );
    }

    // Attendance: pending adjustment requests
    if (has("view_attendance_all") || has("edit_attendance")) {
      queries.push(
        supabase.from("attendance_adjustment_requests").select("id", { count: "exact", head: true }).eq("status", "pending")
          .then(({ count }) => { badges.attendance = count || 0; })
      );
    }

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
