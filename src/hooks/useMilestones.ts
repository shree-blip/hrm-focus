import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Milestone {
  id: string;
  employee_name: string;
  date: Date;
  type: "birthday" | "anniversary";
  /** For anniversaries — how many years */
  years?: number;
  avatar_url?: string | null;
  department?: string | null;
}

/**
 * Fetches birthdays & joining-date anniversaries from the **profiles** table
 * and projects them onto the current calendar year.
 */
export function useMilestones() {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchMilestones = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Fetch from profiles table — matches the Profile page structure
      const [{ data: profiles, error }, { data: employeeRows }, { data: pendingSignups }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, user_id, email, first_name, last_name, date_of_birth, joining_date, department, avatar_url, status")
          .neq("status", "inactive"),
        supabase.from("employees").select("profile_id, email, status"),
        supabase.from("allowed_signups").select("email, is_used").eq("is_used", false),
      ]);

      if (error) {
        console.error("Error fetching milestones:", error);
        setLoading(false);
        return;
      }

      if (!profiles || profiles.length === 0) {
        setMilestones([]);
        setLoading(false);
        return;
      }

      const now = new Date();
      const currentYear = now.getFullYear();
      const result: Milestone[] = [];

      const norm = (v?: string | null) => (v || "").trim().toLowerCase();
      // Deactivated employees (employees.status !== 'active')
      const inactiveProfileIds = new Set<string>();
      const inactiveEmails = new Set<string>();
      for (const e of employeeRows || []) {
        if (norm(e.status) === "active") continue;
        if (e.profile_id) inactiveProfileIds.add(e.profile_id);
        if (e.email) inactiveEmails.add(norm(e.email));
      }
      // Invited but not yet signed up
      const pendingEmails = new Set((pendingSignups || []).map((s) => norm(s.email)));

      for (const profile of profiles) {
        // Skip deactivated accounts and pending (unused) signup invitations
        if (profile.id && inactiveProfileIds.has(profile.id)) continue;
        const email = norm(profile.email);
        if (email && (inactiveEmails.has(email) || pendingEmails.has(email))) continue;

        const firstName = profile.first_name || "";
        const lastName = profile.last_name || "";
        const name = `${firstName} ${lastName}`.trim();

        if (!name) continue; // skip profiles without a name

        // ── Birthday ──────────────────────────────────────────────
        if (profile.date_of_birth) {
          try {
            const dob = new Date(profile.date_of_birth + "T00:00:00");
            if (!isNaN(dob.getTime())) {
              const birthdayThisYear = new Date(currentYear, dob.getMonth(), dob.getDate());
              result.push({
                id: `bday-${profile.id || profile.user_id}`,
                employee_name: name,
                date: birthdayThisYear,
                type: "birthday",
                avatar_url: profile.avatar_url ?? null,
                department: profile.department ?? null,
              });
            }
          } catch {
            // skip invalid date
          }
        }

        // ── Work Anniversary ──────────────────────────────────────
        if (profile.joining_date) {
          try {
            const joined = new Date(profile.joining_date + "T00:00:00");
            if (!isNaN(joined.getTime())) {
              const years = currentYear - joined.getFullYear();
              if (years > 0) {
                const anniversaryThisYear = new Date(currentYear, joined.getMonth(), joined.getDate());
                result.push({
                  id: `anniv-${profile.id || profile.user_id}`,
                  employee_name: name,
                  date: anniversaryThisYear,
                  type: "anniversary",
                  years,
                  avatar_url: profile.avatar_url ?? null,
                  department: profile.department ?? null,
                });
              }
            }
          } catch {
            // skip invalid date
          }
        }
      }

      // Sort by date ascending
      result.sort((a, b) => a.date.getTime() - b.date.getTime());
      setMilestones(result);
    } catch (err) {
      console.error("Error fetching milestones:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchMilestones();
  }, [fetchMilestones]);

  /** Milestones for a specific month */
  const getMilestonesForMonth = useCallback(
    (date: Date) =>
      milestones.filter(
        (m) => m.date.getMonth() === date.getMonth() && m.date.getFullYear() === date.getFullYear(),
      ),
    [milestones],
  );

  /** Does this date have any milestone? */
  const isMilestoneDate = useCallback(
    (date: Date) => milestones.some((m) => m.date.toDateString() === date.toDateString()),
    [milestones],
  );

  /** Get all milestones on a specific date */
  const getMilestonesForDate = useCallback(
    (date: Date) => milestones.filter((m) => m.date.toDateString() === date.toDateString()),
    [milestones],
  );

  /** Upcoming milestones from today, limited to 15 */
  const upcomingMilestones = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return milestones.filter((m) => m.date >= today).slice(0, 15);
  }, [milestones]);

  return {
    milestones,
    loading,
    getMilestonesForMonth,
    isMilestoneDate,
    getMilestonesForDate,
    upcomingMilestones,
    refetch: fetchMilestones,
  };
}
