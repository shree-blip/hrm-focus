import { createContext, useContext, ReactNode, useState, useEffect, useCallback } from "react";
import { useAttendance, AttendanceLog } from "@/hooks/useAttendance";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface TimeTrackerState {
  currentLog: AttendanceLog | null;
  weeklyLogs: AttendanceLog[];
  monthlyLogs: AttendanceLog[];
  loading: boolean;
  clockType: "payroll" | "billable";
  setClockType: (type: "payroll" | "billable") => void;
  clockIn: (type?: "payroll" | "billable", workMode?: "wfo" | "wfh") => Promise<void>;
  clockOut: () => Promise<void>;
  startBreak: () => Promise<void>;
  endBreak: () => Promise<void>;
  startPause: () => Promise<void>;
  endPause: (newWorkMode?: "wfo" | "wfh") => Promise<void>;
  status: "in" | "out" | "break" | "paused";
  monthlyHours: number;
  getTimeBreakdown: (logs: AttendanceLog[]) => {
    net_work_hours: number;
    total_break_time: number;
    total_pause_time: number;
  };
  refetch: () => void;
  actionInProgress: string | null;
  employeeTimezone: string | null;
  employeeTimezoneAbbr: string | null;
  /** Fetch weekly logs for a specific week (used by Attendance page navigation) */
  fetchWeeklyLogsForRange: (weekStart: Date) => Promise<AttendanceLog[]>;
}

const TimeTrackerContext = createContext<TimeTrackerState | null>(null);

export function TimeTrackerProvider({ children }: { children: ReactNode }) {
  const attendance = useAttendance();
  const { user } = useAuth();

  const fetchWeeklyLogsForRange = useCallback(async (weekStart: Date): Promise<AttendanceLog[]> => {
    if (!user) return [];

    const endDate = new Date(Date.UTC(
      weekStart.getUTCFullYear(), weekStart.getUTCMonth(), weekStart.getUTCDate() + 6,
      23, 59, 59, 999
    ));

    const { data, error } = await supabase
      .from("attendance_logs")
      .select("*")
      .eq("user_id", user.id)
      .gte("clock_in", weekStart.toISOString())
      .lte("clock_in", endDate.toISOString())
      .order("clock_in", { ascending: false });

    if (!error && data) {
      return data as AttendanceLog[];
    }
    return [];
  }, [user]);

  const value: TimeTrackerState = {
    ...attendance,
    fetchWeeklyLogsForRange,
  };

  return (
    <TimeTrackerContext.Provider value={value}>
      {children}
    </TimeTrackerContext.Provider>
  );
}

/**
 * Shared time tracker state — consumed by both Dashboard and Attendance pages.
 * Single Supabase Realtime subscription + optimistic UI ensures cross-page
 * and cross-device sync within 1 second.
 */
export function useTimeTracker(): TimeTrackerState {
  const ctx = useContext(TimeTrackerContext);
  if (!ctx) {
    throw new Error("useTimeTracker must be used within <TimeTrackerProvider>");
  }
  return ctx;
}
