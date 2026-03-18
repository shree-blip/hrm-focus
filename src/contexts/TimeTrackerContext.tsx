import { createContext, useContext, ReactNode } from "react";
import { useAttendance, AttendanceLog } from "@/hooks/useAttendance";

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
}

const TimeTrackerContext = createContext<TimeTrackerState | null>(null);

export function TimeTrackerProvider({ children }: { children: ReactNode }) {
  const attendance = useAttendance();

  return (
    <TimeTrackerContext.Provider value={attendance}>
      {children}
    </TimeTrackerContext.Provider>
  );
}

/**
 * Shared time tracker state — consumed by both Dashboard and Attendance pages.
 * Uses a single Supabase Realtime subscription + optimistic UI under the hood.
 */
export function useTimeTracker(): TimeTrackerState {
  const ctx = useContext(TimeTrackerContext);
  if (!ctx) {
    throw new Error("useTimeTracker must be used within <TimeTrackerProvider>");
  }
  return ctx;
}
