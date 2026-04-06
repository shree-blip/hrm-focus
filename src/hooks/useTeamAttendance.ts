import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getUTCDateKey } from "@/utils/timezone";
import { useAuth } from "@/contexts/AuthContext";
import { resolveTeamMemberUserIds } from "@/utils/teamResolver";

interface EmployeeAttendance {
  employee_id: string;
  employee_name: string;
  email: string;
  total_hours: number;
  days_worked: number;
  user_id: string;
}

interface BreakSessionRecord {
  id: string;
  session_type: string;
  start_time: string;
  end_time: string | null;
  duration_minutes: number | null;
}

interface DailyAttendanceRecord {
  id: string;
  user_id: string;
  employee_id: string | null;
  employee_name: string;
  email: string;
  employee_timezone: string;
  clock_in: string;
  clock_out: string | null;
  break_start: string | null;
  break_end: string | null;
  total_break_minutes: number | null;
  pause_start: string | null;
  pause_end: string | null;
  total_pause_minutes: number | null;
  hours_worked: number;
  date: string;
  is_edited: boolean;
  breaks: { break_start: string | null; break_end: string | null; duration_minutes: number }[];
  pauses: { pause_start: string | null; pause_end: string | null; duration_minutes: number }[];
}

export type DateRangeType = "this-month" | "last-month" | "this-quarter" | "this-year";

interface DateRange {
  start: Date;
  end: Date;
}

export function getDateRangeFromType(rangeType: DateRangeType): DateRange {
  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth();
  const currentQuarter = Math.floor(currentMonth / 3);

  switch (rangeType) {
    case "this-month":
      return {
        start: new Date(Date.UTC(currentYear, currentMonth, 1)),
        end: new Date(Date.UTC(currentYear, currentMonth + 1, 0, 23, 59, 59, 999)),
      };
    case "last-month":
      return {
        start: new Date(Date.UTC(currentYear, currentMonth - 1, 1)),
        end: new Date(Date.UTC(currentYear, currentMonth, 0, 23, 59, 59, 999)),
      };
    case "this-quarter":
      const quarterStartMonth = currentQuarter * 3;
      return {
        start: new Date(Date.UTC(currentYear, quarterStartMonth, 1)),
        end: new Date(Date.UTC(currentYear, quarterStartMonth + 3, 0, 23, 59, 59, 999)),
      };
    case "this-year":
      return {
        start: new Date(Date.UTC(currentYear, 0, 1)),
        end: new Date(Date.UTC(currentYear, 11, 31, 23, 59, 59, 999)),
      };
    default:
      return {
        start: new Date(Date.UTC(currentYear, currentMonth, 1)),
        end: new Date(Date.UTC(currentYear, currentMonth + 1, 0, 23, 59, 59, 999)),
      };
  }
}

/**
 * Resolve the set of user_ids a line manager / supervisor can see.
 * Uses the shared team resolver that queries both team_members junction table
 * and legacy manager fields.
 */
async function getTeamUserIds(userId: string): Promise<string[]> {
  return resolveTeamMemberUserIds(userId);
}

export function useTeamAttendance(dateRangeType?: DateRangeType) {
  const { user, isManager, isVP, isAdmin, role, isLineManager, isSupervisor } = useAuth();
  const [teamAttendance, setTeamAttendance] = useState<EmployeeAttendance[]>([]);
  const [dailyAttendance, setDailyAttendance] = useState<DailyAttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTeamAttendance = useCallback(async () => {
    if (!user || (!isManager && !isLineManager)) {
      setLoading(false);
      return;
    }

    const { start: startDate, end: endDate } = getDateRangeFromType(dateRangeType || "this-month");

    // Determine if we need to scope to team only
    // VP and Admin get org-wide access; all other manager types are scoped to their team
    const hasOrgWideAccess = isVP || isAdmin;
    let teamUserIds: string[] | null = null;

    console.debug("[hierarchy][attendance] visibility mode", {
      userId: user.id,
      hasOrgWideAccess,
      dateRangeType: dateRangeType || "this-month",
    });

    if (!hasOrgWideAccess) {
      teamUserIds = await getTeamUserIds(user.id);
      console.debug("[hierarchy][attendance] team user ids", {
        managerUserId: user.id,
        teamUserIdsCount: teamUserIds.length,
        teamUserIds,
      });
      if (!teamUserIds || teamUserIds.length === 0) {
        setTeamAttendance([]);
        setDailyAttendance([]);
        setLoading(false);
        return;
      }
    }

    // Fetch attendance logs
    let query = supabase
      .from("attendance_logs")
      .select(
        `id, user_id, employee_id, clock_in, clock_out, break_start, break_end,
         total_break_minutes, pause_start, pause_end, total_pause_minutes, is_edited`
      )
      .gte("clock_in", startDate.toISOString())
      .lte("clock_in", endDate.toISOString());

    // Scope to team members only for line managers / supervisors
    if (teamUserIds) {
      query = query.in("user_id", teamUserIds);
    }

    const { data: logs, error } = await query;

    if (error) {
      console.error("Error fetching team attendance:", error);
      setLoading(false);
      return;
    }

    // Fetch profiles and employees for name resolution + timezone
    const { data: profiles } = await supabase.from("profiles").select("user_id, first_name, last_name, email");
    const { data: employees } = await supabase.from("employees").select("id, first_name, last_name, email, profile_id, timezone");

    const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) || []);
    const employeeMap = new Map(employees?.map((e) => [e.id, e]) || []);
    // Build a map from profile_id → timezone
    const profileIdToTimezone = new Map(
      employees?.filter(e => e.profile_id).map(e => [e.profile_id, e.timezone || "Asia/Kathmandu"]) || []
    );
    // Build userId → timezone using profiles
    const userTimezoneMap = new Map<string, string>();
    profiles?.forEach(p => {
      const tz = profileIdToTimezone.get(p.user_id) || "Asia/Kathmandu";
      userTimezoneMap.set(p.user_id, tz);
    });
    // Also map via employee.profile_id
    employees?.forEach(e => {
      if (e.profile_id) {
        // profile_id in employees table is profiles.id (which equals profiles.user_id in this schema)
        userTimezoneMap.set(e.profile_id, e.timezone || "Asia/Kathmandu");
      }
    });

    const userTotals = new Map<
      string,
      { hours: number; days: Set<string>; name: string; email: string; employee_id: string }
    >();

    const dailyRecords: DailyAttendanceRecord[] = [];

    logs?.forEach((log) => {
      const userId = log.user_id;
      const employeeId = log.employee_id;

      let name = "Unknown";
      let email = "";

      const profile = profileMap.get(userId);
      if (profile) {
        name = `${profile.first_name} ${profile.last_name}`.trim();
        email = profile.email;
      } else if (employeeId) {
        const employee = employeeMap.get(employeeId);
        if (employee) {
          name = `${employee.first_name} ${employee.last_name}`.trim();
          email = employee.email;
        }
      }

      if (log.clock_out) {
        const clockIn = new Date(log.clock_in);
        const clockOut = new Date(log.clock_out);
        const breakMinutes = log.total_break_minutes || 0;
        const pauseMinutes = log.total_pause_minutes || 0;
        const hours = (clockOut.getTime() - clockIn.getTime() - (breakMinutes + pauseMinutes) * 60 * 1000) / (1000 * 60 * 60);

        const dayKey = getUTCDateKey(log.clock_in);

        if (!userTotals.has(userId)) {
          userTotals.set(userId, { hours: 0, days: new Set(), name, email, employee_id: employeeId || "" });
        }

        const totals = userTotals.get(userId)!;
        totals.hours += Math.max(0, hours);
        totals.days.add(dayKey);
      }

      let hoursWorked = 0;
      if (log.clock_in && log.clock_out) {
        const clockIn = new Date(log.clock_in);
        const clockOut = new Date(log.clock_out);
        const breakMinutes = log.total_break_minutes || 0;
        const pauseMinutes = log.total_pause_minutes || 0;
        const totalMinutes = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60);
        hoursWorked = Math.max(0, (totalMinutes - breakMinutes - pauseMinutes) / 60);
      }

      const empTz = userTimezoneMap.get(userId) || "Asia/Kathmandu";

      dailyRecords.push({
        id: log.id,
        user_id: userId,
        employee_id: employeeId,
        employee_name: name,
        email: email,
        employee_timezone: empTz,
        clock_in: log.clock_in,
        clock_out: log.clock_out,
        break_start: log.break_start,
        break_end: log.break_end,
        total_break_minutes: log.total_break_minutes,
        pause_start: log.pause_start,
        pause_end: log.pause_end,
        total_pause_minutes: log.total_pause_minutes,
        hours_worked: hoursWorked,
        date: getUTCDateKey(log.clock_in),
        is_edited: !!(log as any).is_edited,
      });
    });

    const result: EmployeeAttendance[] = Array.from(userTotals.entries()).map(([userId, data]) => ({
      user_id: userId,
      employee_id: data.employee_id,
      employee_name: data.name,
      email: data.email,
      total_hours: Math.round(data.hours * 10) / 10,
      days_worked: data.days.size,
    }));

    setTeamAttendance(result.sort((a, b) => b.total_hours - a.total_hours));
    setDailyAttendance(dailyRecords.sort((a, b) => new Date(b.clock_in).getTime() - new Date(a.clock_in).getTime()));
    setLoading(false);
  }, [user, isManager, isVP, isAdmin, role, isLineManager, isSupervisor, dateRangeType]);

  // Debounce realtime to prevent cascading re-fetches
  const realtimeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetchTeamAttendance();

    const debouncedFetch = () => {
      if (realtimeTimerRef.current) clearTimeout(realtimeTimerRef.current);
      realtimeTimerRef.current = setTimeout(() => fetchTeamAttendance(), 500);
    };

    const attendanceChannel = supabase
      .channel("team-attendance-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance_logs" }, debouncedFetch)
      .subscribe();

    return () => {
      if (realtimeTimerRef.current) clearTimeout(realtimeTimerRef.current);
      supabase.removeChannel(attendanceChannel);
    };
  }, [fetchTeamAttendance]);

  return {
    teamAttendance,
    dailyAttendance,
    loading,
    refetch: fetchTeamAttendance,
  };
}
