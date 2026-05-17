import { supabase } from "@/integrations/supabase/client";
import { resolveManagerUserIds } from "@/utils/teamResolver";

/**
 * Centralised in-app notification helpers used across the HRM.
 * All functions are best-effort: failures are logged but never thrown so
 * they cannot break the underlying business action.
 *
 * IMPORTANT: This file only handles in-app bell notifications via the
 * existing `create_notification` RPC. It does NOT touch email/Resend logic.
 */

export type NotifyType = "info" | "success" | "warning" | "error";

export interface NotifyPayload {
  title: string;
  message: string;
  link?: string | null;
  type?: NotifyType;
}

/** Fire a single notification for one user. Silently swallows errors. */
export async function notifyUser(userId: string | null | undefined, p: NotifyPayload): Promise<void> {
  if (!userId) return;
  try {
    const { error } = await supabase.rpc("create_notification", {
      p_user_id: userId,
      p_title: p.title,
      p_message: p.message,
      p_type: p.type || "info",
      p_link: p.link ?? null,
    });
    if (error) console.error("[notify] create_notification error:", error);
  } catch (err) {
    console.error("[notify] unexpected error:", err);
  }
}

/** Notify many users. Deduplicates, optionally excludes one id (usually the actor). */
export async function notifyUsers(
  userIds: Array<string | null | undefined>,
  p: NotifyPayload,
  opts: { excludeUserId?: string | null } = {},
): Promise<void> {
  const set = new Set<string>();
  for (const id of userIds) {
    if (id && id !== opts.excludeUserId) set.add(id);
  }
  if (set.size === 0) return;
  await Promise.all(Array.from(set).map((uid) => notifyUser(uid, p)));
}

/** Get all Admin + VP user ids (Executive/CEO is stored as 'vp'). */
export async function getAdminAndVpUserIds(): Promise<string[]> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("user_id")
    .in("role", ["admin", "vp"]);
  if (error || !data) return [];
  return Array.from(new Set(data.map((r) => r.user_id).filter(Boolean) as string[]));
}

/** Get all active profile user ids (org-wide broadcast). */
export async function getAllActiveUserIds(): Promise<string[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("user_id, status")
    .not("user_id", "is", null);
  if (error || !data) return [];
  return data
    .filter((p) => (p.status ?? "active") !== "inactive")
    .map((p) => p.user_id as string)
    .filter(Boolean);
}

/**
 * Resolve the management chain for an employee (by their auth user_id):
 * direct line manager + supervisor(s) (resolveManagerUserIds covers both
 * line_manager_id, manager_id and team_members junction).
 */
export async function getDirectManagerUserIds(employeeUserId: string): Promise<string[]> {
  try {
    return await resolveManagerUserIds(employeeUserId);
  } catch (err) {
    console.error("[notify] resolveManagerUserIds failed:", err);
    return [];
  }
}

/**
 * Full management distribution list for a given employee (by their auth user_id):
 * line manager + supervisor + admin + vp, deduped, excluding the employee themself.
 */
export async function getManagementChainUserIds(employeeUserId: string): Promise<string[]> {
  const [managers, adminsVps] = await Promise.all([
    getDirectManagerUserIds(employeeUserId),
    getAdminAndVpUserIds(),
  ]);
  const set = new Set<string>([...managers, ...adminsVps]);
  set.delete(employeeUserId);
  return Array.from(set);
}

/** Resolve auth user_id from an employee row id. */
export async function getUserIdForEmployee(employeeId: string): Promise<string | null> {
  const { data: emp } = await supabase
    .from("employees")
    .select("profile_id, email")
    .eq("id", employeeId)
    .maybeSingle();
  if (!emp) return null;
  if (emp.profile_id) {
    const { data: p } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("id", emp.profile_id)
      .maybeSingle();
    if (p?.user_id) return p.user_id;
  }
  if (emp.email) {
    const { data: p2 } = await supabase
      .from("profiles")
      .select("user_id")
      .ilike("email", emp.email)
      .maybeSingle();
    if (p2?.user_id) return p2.user_id;
  }
  return null;
}

/** Fetch an employee's display name. */
export async function getEmployeeDisplayName(userId: string): Promise<string> {
  const { data } = await supabase
    .from("profiles")
    .select("first_name, last_name")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return "Employee";
  return `${data.first_name || ""} ${data.last_name || ""}`.trim() || "Employee";
}
