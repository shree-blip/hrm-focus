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
  employment_type: string;
  break_end: string | null;
  total_break_minutes: number | null;
  pause_start: string | null;
  pause_end: string | null;
  total_pause_minutes: number | null;
  hours_worked: number;
  date: string;
  is_edited: boolean;
  location_name: string | null;
  work_mode: string | null;
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

export function useTeamAttendance(dateRangeType?: DateRangeType, customRange?: { start: Date; end: Date } | null) {
  const { user, isManager, isVP, isAdmin, role, isLineManager, isSupervisor } = useAuth();
  const [teamAttendance, setTeamAttendance] = useState<EmployeeAttendance[]>([]);
  const [dailyAttendance, setDailyAttendance] = useState<DailyAttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Cache the org-wide name/timezone lookup tables. These are only used for
  // display resolution and are NOT part of the realtime subscriptions below
  // (which only watch attendance_logs / attendance_break_sessions). Caching
  // them prevents re-reading the entire profiles + employees tables on every
  // attendance event. Cleared on unmount so a fresh mount reloads them.
  const profilesCacheRef = useRef<any[] | null>(null);
  const employeesCacheRef = useRef<any[] | null>(null);

  const fetchTeamAttendance = useCallback(async () => {
    if (!user || (!isManager && !isLineManager)) {
      setLoading(false);
      return;
    }

    const { start: startDate, end: endDate } =
      customRange && customRange.start && customRange.end
        ? customRange
        : getDateRangeFromType(dateRangeType || "this-month");

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
         total_break_minutes, pause_start, pause_end, total_pause_minutes, is_edited,
         location_name, work_mode`
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

    // Fetch break/pause sessions for all logs
    const logIds = logs?.map((l) => l.id) || [];
    let sessionsMap = new Map<string, BreakSessionRecord[]>();
    if (logIds.length > 0) {
      // Fetch in batches of 200 to avoid query limits
      const batchSize = 200;
      const allSessions: (BreakSessionRecord & { attendance_log_id: string })[] = [];
      for (let i = 0; i < logIds.length; i += batchSize) {
        const batch = logIds.slice(i, i + batchSize);
        const { data: sessions } = await supabase
          .from("attendance_break_sessions")
          .select("id, attendance_log_id, session_type, start_time, end_time, duration_minutes")
          .in("attendance_log_id", batch)
          .order("start_time", { ascending: true });
        if (sessions) allSessions.push(...(sessions as any));
      }
      allSessions.forEach((s) => {
        const arr = sessionsMap.get(s.attendance_log_id) || [];
        arr.push(s);
        sessionsMap.set(s.attendance_log_id, arr);
      });
    }

    // Fetch profiles and employees for name resolution + timezone.
    // Served from an in-memory cache after the first load so realtime-driven
    // refetches don't re-read these whole tables on every attendance event.
    let profiles = profilesCacheRef.current;
    let employees = employeesCacheRef.current;
    if (!profiles || !employees) {
      const [profilesRes, employeesRes] = await Promise.all([
        supabase.from("profiles").select("id, user_id, first_name, last_name, email"),
        supabase.from("employees").select("id, first_name, last_name, email, profile_id, timezone, employment_type"),
      ]);
      profiles = profilesRes.data || [];
      employees = employeesRes.data || [];
      profilesCacheRef.current = profiles;
      employeesCacheRef.current = employees;
    }

    const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) || []);
    const employeeMap = new Map(employees?.map((e) => [e.id, e]) || []);
    // Map a profile's primary key (profiles.id, referenced by employees.profile_id)
    // to the auth user_id that attendance_logs.user_id actually stores.
    const profileIdToUserId = new Map(profiles?.map((p) => [p.id, p.user_id]) || []);

    // Resolve timezone & employment type keyed by the auth user_id used in logs.
    const userTimezoneMap = new Map<string, string>();
    const userEmploymentTypeMap = new Map<string, string>();
    employees?.forEach((e) => {
      if (!e.profile_id) return;
      const uid = profileIdToUserId.get(e.profile_id);
      if (!uid) return;
      userTimezoneMap.set(uid, e.timezone || "Asia/Kathmandu");
      userEmploymentTypeMap.set(uid, (e as any).employment_type || "full_time");
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

      // Fallback to direct employee record when the log is linked by employee_id only.
      const empById = employeeId ? employeeMap.get(employeeId) : undefined;
      const empTz =
        userTimezoneMap.get(userId) || empById?.timezone || "Asia/Kathmandu";
      const empType =
        userEmploymentTypeMap.get(userId) ||
        (empById as any)?.employment_type ||
        "full_time";

      // Build breaks and pauses arrays from sessions
      const sessions = sessionsMap.get(log.id) || [];
      const breaks = sessions
        .filter((s) => s.session_type === "break")
        .map((s) => ({
          break_start: s.start_time,
          break_end: s.end_time,
          duration_minutes: s.duration_minutes || 0,
        }));
      const pauses = sessions
        .filter((s) => s.session_type === "pause")
        .map((s) => ({
          pause_start: s.start_time,
          pause_end: s.end_time,
          duration_minutes: s.duration_minutes || 0,
        }));

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
        employment_type: empType,
        break_end: log.break_end,
        total_break_minutes: log.total_break_minutes,
        pause_start: log.pause_start,
        pause_end: log.pause_end,
        total_pause_minutes: log.total_pause_minutes,
        hours_worked: hoursWorked,
        date: getUTCDateKey(log.clock_in),
        is_edited: !!(log as any).is_edited,
        location_name: log.location_name || null,
        work_mode: (log as any).work_mode || null,
        breaks,
        pauses,
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
  }, [
    user,
    isManager,
    isVP,
    isAdmin,
    role,
    isLineManager,
    isSupervisor,
    dateRangeType,
    customRange?.start?.getTime(),
    customRange?.end?.getTime(),
  ]);

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
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance_break_sessions" }, debouncedFetch)
      .subscribe();

    return () => {
      if (realtimeTimerRef.current) clearTimeout(realtimeTimerRef.current);
      supabase.removeChannel(attendanceChannel);
      // Drop the cached lookup tables so a fresh mount reloads them.
      profilesCacheRef.current = null;
      employeesCacheRef.current = null;
    };
  }, [fetchTeamAttendance]);

  return {
    teamAttendance,
    dailyAttendance,
    loading,
    refetch: fetchTeamAttendance,
  };
}
