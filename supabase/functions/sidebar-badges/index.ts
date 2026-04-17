import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

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

    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: authError } = await anonClient.auth.getClaims(token);
    if (authError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    const supabase = createClient(supabaseUrl, serviceKey);

    // Fetch role + permissions in parallel
    const [rolePermsResult, overridesResult, userRoleResult] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId).limit(1).single()
        .then(async ({ data: roleData }) => {
          if (!roleData) return { data: [], role: null as string | null };
          const r = await supabase.from("role_permissions").select("permission, enabled").eq("role", roleData.role);
          return { data: r.data, role: roleData.role as string };
        }),
      supabase.from("user_permission_overrides").select("permission, enabled").eq("user_id", userId),
      supabase.from("user_roles").select("role").eq("user_id", userId).limit(1).single(),
    ]);

    const role = (userRoleResult.data?.role as string | null) ?? null;
    const isAdmin = role === "admin" || role === "vp";
    // Line managers / supervisors must be scoped to their team
    const isTeamScoped = !isAdmin && (role === "supervisor" || role === "line_manager" || role === "manager");

    // Build effective permission set
    const perms = new Set<string>();
    if (rolePermsResult.data) {
      for (const rp of rolePermsResult.data as any[]) {
        if (rp.enabled) perms.add(rp.permission);
      }
    }
    if (overridesResult.data) {
      for (const o of overridesResult.data as any[]) {
        if (o.enabled) perms.add(o.permission);
        else perms.delete(o.permission);
      }
    }

    const has = (p: string) => perms.has(p);

    // Resolve subordinate user_ids and employee_ids if team-scoped
    let teamUserIds: string[] = [];
    let teamEmployeeIds: string[] = [];
    if (isTeamScoped) {
      const { data: subUserIds } = await supabase.rpc("get_all_subordinate_user_ids", {
        _manager_user_id: userId,
      });
      teamUserIds = ((subUserIds as string[] | null) || []).filter(Boolean);

      const { data: managerEmpId } = await supabase.rpc("get_employee_id_for_user", { _user_id: userId });
      if (managerEmpId) {
        const { data: subEmpIds } = await supabase.rpc("get_all_subordinate_employee_ids", {
          _manager_employee_id: managerEmpId,
        });
        teamEmployeeIds = ((subEmpIds as string[] | null) || []).filter(Boolean);
      }
    }

    const badges: Record<string, number> = {};
    const queries: PromiseLike<void>[] = [];

    // Helper: short-circuit when team-scoped but no team members
    const teamScopedEmpty = isTeamScoped && teamUserIds.length === 0;

    // Leave: pending
    if (has("approve_leave")) {
      if (isAdmin) {
        queries.push(
          supabase.from("leave_requests").select("id", { count: "exact", head: true }).eq("status", "pending")
            .then(({ count }) => { badges.leave = count || 0; })
        );
      } else if (isTeamScoped) {
        if (teamScopedEmpty) {
          badges.leave = 0;
        } else {
          queries.push(
            supabase.from("leave_requests").select("id", { count: "exact", head: true })
              .eq("status", "pending").in("user_id", teamUserIds)
              .then(({ count }) => { badges.leave = count || 0; })
          );
        }
      } else {
        queries.push(
          supabase.from("leave_requests").select("id", { count: "exact", head: true }).eq("status", "pending")
            .then(({ count }) => { badges.leave = count || 0; })
        );
      }
    } else if (has("view_leave")) {
      queries.push(
        supabase.from("leave_requests").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "pending")
          .then(({ count }) => { badges.leave = count || 0; })
      );
    }

    // Approvals: pending leave requests (for approvers)
    if (has("approve_leave")) {
      if (isAdmin) {
        queries.push(
          supabase.from("leave_requests").select("id", { count: "exact", head: true }).eq("status", "pending")
            .then(({ count }) => { badges.approvals = count || 0; })
        );
      } else if (isTeamScoped) {
        if (teamScopedEmpty) {
          badges.approvals = 0;
        } else {
          queries.push(
            supabase.from("leave_requests").select("id", { count: "exact", head: true })
              .eq("status", "pending").in("user_id", teamUserIds)
              .then(({ count }) => { badges.approvals = count || 0; })
          );
        }
      }
    }

    // Tasks: open tasks assigned to user (always self-scoped)
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

    // Announcements: active (org-wide for everyone)
    if (has("view_announcements") || has("add_announcement")) {
      queries.push(
        supabase.from("announcements").select("id", { count: "exact", head: true }).eq("is_active", true)
          .then(({ count }) => { badges.announcements = count || 0; })
      );
    }

    // Documents: unread shared (always recipient-scoped)
    if (has("view_documents") || has("manage_documents")) {
      queries.push(
        supabase.from("document_shares").select("id", { count: "exact", head: true }).eq("recipient_id", userId).eq("is_read", false)
          .then(({ count }) => { badges.documents = count || 0; })
      );
    }

    // Invoices
    if (has("manage_invoices")) {
      if (isAdmin) {
        queries.push(
          supabase.from("invoices").select("id", { count: "exact", head: true }).eq("status", "submitted")
            .then(({ count }) => { badges.invoices = count || 0; })
        );
      } else if (isTeamScoped) {
        if (teamScopedEmpty) {
          badges.invoices = 0;
        } else {
          queries.push(
            supabase.from("invoices").select("id", { count: "exact", head: true })
              .eq("status", "submitted").in("user_id", teamUserIds)
              .then(({ count }) => { badges.invoices = count || 0; })
          );
        }
      } else {
        queries.push(
          supabase.from("invoices").select("id", { count: "exact", head: true }).eq("status", "submitted")
            .then(({ count }) => { badges.invoices = count || 0; })
        );
      }
    } else if (has("view_invoices")) {
      queries.push(
        supabase.from("invoices").select("id", { count: "exact", head: true }).eq("user_id", userId).in("status", ["submitted", "draft"])
          .then(({ count }) => { badges.invoices = count || 0; })
      );
    }

    // Loans
    if (has("manage_loans")) {
      if (isAdmin) {
        queries.push(
          supabase.from("loan_requests").select("id", { count: "exact", head: true })
            .in("status", ["pending", "manager_approved", "hr_reviewed"])
            .then(({ count }) => { badges.loans = count || 0; })
        );
      } else if (isTeamScoped) {
        if (teamScopedEmpty) {
          badges.loans = 0;
        } else {
          queries.push(
            supabase.from("loan_requests").select("id", { count: "exact", head: true })
              .in("status", ["pending", "manager_approved", "hr_reviewed"])
              .in("user_id", teamUserIds)
              .then(({ count }) => { badges.loans = count || 0; })
          );
        }
      } else {
        queries.push(
          supabase.from("loan_requests").select("id", { count: "exact", head: true })
            .in("status", ["pending", "manager_approved", "hr_reviewed"])
            .then(({ count }) => { badges.loans = count || 0; })
        );
      }
    } else if (has("view_loans")) {
      queries.push(
        supabase.from("loan_requests").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "pending")
          .then(({ count }) => { badges.loans = count || 0; })
      );
    }

    // Support: aggregate (scope to team for line manager/supervisor)
    if (has("manage_support") || has("view_support") || has("view_bug_reports") || has("view_grievances") || has("view_asset_requests")) {
      const supportCounts: PromiseLike<number>[] = [];
      const scopeUserFilter = (q: any) => isTeamScoped ? q.in("user_id", teamUserIds) : q;

      if (has("manage_support") || has("view_bug_reports")) {
        if (isTeamScoped && teamScopedEmpty) {
          supportCounts.push(Promise.resolve(0));
        } else {
          let q: any = supabase.from("bug_reports").select("id", { count: "exact", head: true }).in("status", ["open", "in_progress"]);
          q = scopeUserFilter(q);
          supportCounts.push(q.then(({ count }: any) => count || 0));
        }
      }
      if (has("manage_support") || has("view_grievances")) {
        if (isTeamScoped && teamScopedEmpty) {
          supportCounts.push(Promise.resolve(0));
        } else {
          let q: any = supabase.from("grievances").select("id", { count: "exact", head: true }).in("status", ["open", "investigating"]);
          q = scopeUserFilter(q);
          supportCounts.push(q.then(({ count }: any) => count || 0));
        }
      }
      if (has("manage_support") || has("view_asset_requests")) {
        if (isTeamScoped && teamScopedEmpty) {
          supportCounts.push(Promise.resolve(0));
        } else {
          let q: any = supabase.from("asset_requests").select("id", { count: "exact", head: true }).eq("status", "pending");
          q = scopeUserFilter(q);
          supportCounts.push(q.then(({ count }: any) => count || 0));
        }
      }

      queries.push(
        Promise.all(supportCounts).then((counts) => {
          badges.support = counts.reduce((a, b) => a + b, 0);
        })
      );
    }

    // Attendance: pending adjustment requests
    if (has("view_attendance_all") || has("edit_attendance")) {
      if (isAdmin) {
        queries.push(
          supabase.from("attendance_adjustment_requests").select("id", { count: "exact", head: true }).eq("status", "pending")
            .then(({ count }) => { badges.attendance = count || 0; })
        );
      } else if (isTeamScoped) {
        if (teamScopedEmpty) {
          badges.attendance = 0;
        } else {
          // adjustment requests link to attendance_logs which have employee_id; filter via requested_by user ids
          queries.push(
            supabase.from("attendance_adjustment_requests").select("id", { count: "exact", head: true })
              .eq("status", "pending").in("requested_by", teamUserIds)
              .then(({ count }) => { badges.attendance = count || 0; })
          );
        }
      } else {
        queries.push(
          supabase.from("attendance_adjustment_requests").select("id", { count: "exact", head: true }).eq("status", "pending")
            .then(({ count }) => { badges.attendance = count || 0; })
        );
      }
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
