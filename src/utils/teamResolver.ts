import { supabase } from "@/integrations/supabase/client";

/**
 * Resolves ALL team member user_ids for a given manager.
 * Queries BOTH the team_members junction table AND legacy line_manager_id/manager_id fields,
 * then deduplicates results.
 *
 * Returns an array of user_ids (from auth/profiles) for the manager's team members.
 */
export async function resolveTeamMemberUserIds(managerUserId: string): Promise<string[]> {
  // 1. Get manager's employee ID
  const { data: myEmpId } = await supabase.rpc("get_employee_id_for_user", {
    _user_id: managerUserId,
  });

  if (!myEmpId) return [];

  // 2. Fetch from BOTH sources in parallel
  const [junctionResult, legacyResult] = await Promise.all([
    // Junction table (new system)
    supabase
      .from("team_members")
      .select("member_employee_id")
      .eq("manager_employee_id", myEmpId),
    // Legacy fields
    supabase
      .from("employees")
      .select("id, profile_id")
      .or(`line_manager_id.eq.${myEmpId},manager_id.eq.${myEmpId}`),
  ]);

  // Collect all unique employee IDs
  const employeeIdSet = new Set<string>();

  // From junction table
  if (junctionResult.data) {
    for (const row of junctionResult.data) {
      employeeIdSet.add(row.member_employee_id);
    }
  }

  // From legacy fields
  if (legacyResult.data) {
    for (const row of legacyResult.data) {
      employeeIdSet.add(row.id);
    }
  }

  if (employeeIdSet.size === 0) return [];

  const employeeIds = Array.from(employeeIdSet);

  // 3. Resolve employee IDs → profile_ids → user_ids
  const { data: employees } = await supabase
    .from("employees")
    .select("id, profile_id, email")
    .in("id", employeeIds);

  if (!employees || employees.length === 0) return [];

  const profileIds = employees.map((e) => e.profile_id).filter(Boolean) as string[];
  const empIdsWithoutProfile = employees.filter((e) => !e.profile_id);

  const userIdSet = new Set<string>();

  // Resolve via profile_id
  if (profileIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id")
      .in("id", profileIds);

    if (profiles) {
      for (const p of profiles) {
        if (p.user_id) userIdSet.add(p.user_id);
      }
    }
  }

  // Fallback: resolve via email for employees without profile_id
  if (empIdsWithoutProfile.length > 0) {
    const emails = empIdsWithoutProfile.map((e) => e.email);
    const { data: matchedProfiles } = await supabase
      .from("profiles")
      .select("user_id")
      .in("email", emails);

    if (matchedProfiles) {
      for (const p of matchedProfiles) {
        if (p.user_id) userIdSet.add(p.user_id);
      }
    }
  }

  return Array.from(userIdSet);
}

/**
 * Resolves ALL manager user_ids for a given employee.
 * Queries BOTH the team_members junction table AND legacy line_manager_id/manager_id fields.
 *
 * Returns an array of user_ids of the managers assigned to this employee.
 */
export async function resolveManagerUserIds(employeeUserId: string): Promise<string[]> {
  // 1. Get employee's employee ID
  const { data: myEmpId } = await supabase.rpc("get_employee_id_for_user", {
    _user_id: employeeUserId,
  });

  if (!myEmpId) return [];

  // 2. Fetch from BOTH sources in parallel
  const [junctionResult, legacyResult] = await Promise.all([
    // Junction table: find all managers who have this employee as a member
    supabase
      .from("team_members")
      .select("manager_employee_id")
      .eq("member_employee_id", myEmpId),
    // Legacy fields
    supabase
      .from("employees")
      .select("line_manager_id, manager_id")
      .eq("id", myEmpId)
      .single(),
  ]);

  const managerEmpIdSet = new Set<string>();

  if (junctionResult.data) {
    for (const row of junctionResult.data) {
      managerEmpIdSet.add(row.manager_employee_id);
    }
  }

  if (legacyResult.data) {
    if (legacyResult.data.line_manager_id) managerEmpIdSet.add(legacyResult.data.line_manager_id);
    if (legacyResult.data.manager_id) managerEmpIdSet.add(legacyResult.data.manager_id);
  }

  if (managerEmpIdSet.size === 0) return [];

  const managerEmpIds = Array.from(managerEmpIdSet);

  // 3. Resolve to user_ids
  const { data: managerEmps } = await supabase
    .from("employees")
    .select("profile_id")
    .in("id", managerEmpIds);

  if (!managerEmps) return [];

  const profileIds = managerEmps.map((e) => e.profile_id).filter(Boolean) as string[];
  if (profileIds.length === 0) return [];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id")
    .in("id", profileIds);

  return profiles?.map((p) => p.user_id).filter(Boolean) as string[] || [];
}
