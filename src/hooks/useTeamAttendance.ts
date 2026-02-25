import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface EmployeeAttendance {
  employee_id: string;
  employee_name: string;
  email: string;
  total_hours: number;
  days_worked: number;
  user_id: string;
}

interface DailyAttendanceRecord {
  id: string;
  user_id: string;
  employee_id: string | null;
  employee_name: string;
  email: string;
  clock_in: string;
  clock_out: string | null;
  break_start: string | null;
  break_end: string | null;
  total_break_minutes: number | null;
  // Pause fields
  pause_start: string | null;
  pause_end: string | null;
  total_pause_minutes: number | null;
  hours_worked: number;
  date: string;
  is_edited: boolean;
}

export type DateRangeType = "this-month" | "last-month" | "this-quarter" | "this-year";

interface DateRange {
  start: Date;
  end: Date;
}

// Helper function to calculate date range based on selection
export function getDateRangeFromType(rangeType: DateRangeType): DateRange {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const currentQuarter = Math.floor(currentMonth / 3);

  switch (rangeType) {
    case "this-month":
      return {
        start: new Date(currentYear, currentMonth, 1),
        end: new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999),
      };
    case "last-month":
      return {
        start: new Date(currentYear, currentMonth - 1, 1),
        end: new Date(currentYear, currentMonth, 0, 23, 59, 59, 999),
      };
    case "this-quarter":
      const quarterStartMonth = currentQuarter * 3;
      return {
        start: new Date(currentYear, quarterStartMonth, 1),
        end: new Date(currentYear, quarterStartMonth + 3, 0, 23, 59, 59, 999),
      };
    case "this-year":
      return {
        start: new Date(currentYear, 0, 1),
        end: new Date(currentYear, 11, 31, 23, 59, 59, 999),
      };
    default:
      return {
        start: new Date(currentYear, currentMonth, 1),
        end: new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999),
      };
  }
}

export function useTeamAttendance(dateRangeType?: DateRangeType) {
  const { isManager } = useAuth();
  const [teamAttendance, setTeamAttendance] = useState<EmployeeAttendance[]>([]);
  const [dailyAttendance, setDailyAttendance] = useState<DailyAttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTeamAttendance = useCallback(async () => {
    if (!isManager) {
      setLoading(false);
      return;
    }

    // Get date range based on selection (default to this-month)
    const { start: startDate, end: endDate } = getDateRangeFromType(dateRangeType || "this-month");

    // Fetch attendance logs with profile info
    const { data: logs, error } = await supabase
      .from("attendance_logs")
      .select(
        `
        id,
        user_id,
        employee_id,
        clock_in,
        clock_out,
        break_start,
        break_end,
        total_break_minutes,
        pause_start,
        pause_end,
        total_pause_minutes,
        is_edited
      `,
      )
      .gte("clock_in", startDate.toISOString())
      .lte("clock_in", endDate.toISOString());

    if (error) {
      console.error("Error fetching team attendance:", error);
      setLoading(false);
      return;
    }

    // Fetch profiles to get names
    const { data: profiles } = await supabase.from("profiles").select("user_id, first_name, last_name, email");

    // Fetch employees to map employee_id to names
    const { data: employees } = await supabase.from("employees").select("id, first_name, last_name, email, profile_id");

    // Create a map of user_id to profile
    const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) || []);
    const employeeMap = new Map(employees?.map((e) => [e.id, e]) || []);

    // Group logs by user_id and calculate totals for summary
    const userTotals = new Map<
      string,
      { hours: number; days: Set<string>; name: string; email: string; employee_id: string }
    >();

    // Process daily attendance records
    const dailyRecords: DailyAttendanceRecord[] = [];

    logs?.forEach((log) => {
      const userId = log.user_id;
      const employeeId = log.employee_id;

      // Get name from profile or employee
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

      // Calculate hours for summary (only completed records, excluding breaks AND pauses)
      if (log.clock_out) {
        const clockIn = new Date(log.clock_in);
        const clockOut = new Date(log.clock_out);
        const breakMinutes = log.total_break_minutes || 0;
        const pauseMinutes = log.total_pause_minutes || 0;
        const hours = (clockOut.getTime() - clockIn.getTime() - (breakMinutes + pauseMinutes) * 60 * 1000) / (1000 * 60 * 60);

        const dayKey = clockIn.toISOString().split("T")[0];

        if (!userTotals.has(userId)) {
          userTotals.set(userId, { hours: 0, days: new Set(), name, email, employee_id: employeeId || "" });
        }

        const totals = userTotals.get(userId)!;
        totals.hours += Math.max(0, hours);
        totals.days.add(dayKey);
      }

      // Calculate hours for daily records (excluding breaks AND pauses)
      let hoursWorked = 0;
      if (log.clock_in && log.clock_out) {
        const clockIn = new Date(log.clock_in);
        const clockOut = new Date(log.clock_out);
        const breakMinutes = log.total_break_minutes || 0;
        const pauseMinutes = log.total_pause_minutes || 0;
        const totalMinutes = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60);
        hoursWorked = Math.max(0, (totalMinutes - breakMinutes - pauseMinutes) / 60);
      }

      // Add to daily records with pause fields
      dailyRecords.push({
        id: log.id,
        user_id: userId,
        employee_id: employeeId,
        employee_name: name,
        email: email,
        clock_in: log.clock_in,
        clock_out: log.clock_out,
        break_start: log.break_start,
        break_end: log.break_end,
        total_break_minutes: log.total_break_minutes,
        pause_start: log.pause_start,
        pause_end: log.pause_end,
        total_pause_minutes: log.total_pause_minutes,
        hours_worked: hoursWorked,
        date: log.clock_in.split("T")[0],
        is_edited: !!(log as any).is_edited,
      });
    });

    // Convert summary to array
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
  }, [isManager, dateRangeType]);

  useEffect(() => {
    fetchTeamAttendance();

    // Set up realtime subscription
    const attendanceChannel = supabase
      .channel("team-attendance-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance_logs" }, () => fetchTeamAttendance())
      .subscribe();

    return () => {
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
