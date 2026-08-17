import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Probation leave policy
 * ----------------------
 * Employees on probation get a FIXED quota of 3 days for the ENTIRE probation
 * period (not per month). Extending the probation end date never increases the
 * quota, and leave already taken carries over into the extended period.
 *
 * Usage is derived from the leave requests whose start date falls inside the
 * probation window, so an extension automatically keeps counting the earlier
 * days. Special leaves (wedding/bereavement/maternity/paternity), Leave in Lieu
 * and leaves explicitly marked as Unpaid do not consume the probation quota.
 */
export const PROBATION_LEAVE_QUOTA = 3;

const SPECIAL_LEAVE_TYPES = ["Wedding Leave", "Bereavement Leave", "Maternity Leave", "Paternity Leave"];

const isUnpaid = (reason: string | null | undefined) =>
  !!reason && /\[(payroll|unpaid leave)\]/i.test(reason);

const consumesQuota = (leaveType: string, reason: string | null | undefined) => {
  if (leaveType.startsWith("Leave in Lieu") || leaveType.startsWith("Leave on Lieu")) return false;
  if (SPECIAL_LEAVE_TYPES.includes(leaveType)) return false;
  if (isUnpaid(reason)) return false;
  return true;
};

export interface ProbationLeaveInfo {
  loading: boolean;
  isProbation: boolean;
  quota: number;
  used: number;
  remaining: number;
  probationStart: string | null;
  probationEnd: string | null;
}

export function useProbationLeave(): ProbationLeaveInfo & { refetch: () => void } {
  const { user } = useAuth();
  const [info, setInfo] = useState<ProbationLeaveInfo>({
    loading: true,
    isProbation: false,
    quota: PROBATION_LEAVE_QUOTA,
    used: 0,
    remaining: PROBATION_LEAVE_QUOTA,
    probationStart: null,
    probationEnd: null,
  });

  const load = useCallback(async () => {
    if (!user?.id) {
      setInfo((prev) => ({ ...prev, loading: false, isProbation: false }));
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile?.id) {
      setInfo((prev) => ({ ...prev, loading: false, isProbation: false }));
      return;
    }

    const { data: employee } = await supabase
      .from("employees")
      .select("employment_type, probation_start_date, probation_end_date")
      .eq("profile_id", profile.id)
      .maybeSingle();

    if (!employee || employee.employment_type !== "probation") {
      setInfo({
        loading: false,
        isProbation: false,
        quota: PROBATION_LEAVE_QUOTA,
        used: 0,
        remaining: PROBATION_LEAVE_QUOTA,
        probationStart: employee?.probation_start_date ?? null,
        probationEnd: employee?.probation_end_date ?? null,
      });
      return;
    }

    let query = supabase
      .from("leave_requests")
      .select("leave_type, days, status, start_date, reason")
      .eq("user_id", user.id)
      .in("status", ["pending", "approved"]);

    if (employee.probation_start_date) query = query.gte("start_date", employee.probation_start_date);
    if (employee.probation_end_date) query = query.lte("start_date", employee.probation_end_date);

    const { data: requests } = await query;

    const used = (requests ?? [])
      .filter((r) => consumesQuota(r.leave_type, r.reason))
      .reduce((sum, r) => sum + Number(r.days || 0), 0);

    setInfo({
      loading: false,
      isProbation: true,
      quota: PROBATION_LEAVE_QUOTA,
      used,
      remaining: PROBATION_LEAVE_QUOTA - used,
      probationStart: employee.probation_start_date ?? null,
      probationEnd: employee.probation_end_date ?? null,
    });
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  return { ...info, refetch: load };
}
