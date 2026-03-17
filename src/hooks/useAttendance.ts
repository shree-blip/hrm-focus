import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

interface AttendanceLog {
  id: string;
  clock_in: string;
  clock_out: string | null;
  break_start: string | null;
  break_end: string | null;
  total_break_minutes: number;
  pause_start: string | null;
  pause_end: string | null;
  total_pause_minutes: number;
  clock_type: "payroll" | "billable";
  status: "active" | "break" | "paused" | "completed" | "auto_clocked_out";
  location_name?: string;
}

/**
 * Calls the server-side attendance-clock edge function.
 * The server is the SINGLE SOURCE OF TRUTH for timestamps.
 * Client NEVER sends timezone info — only action + IDs.
 */
async function callAttendanceClock(payload: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const res = await fetch(
    `https://${projectId}.supabase.co/functions/v1/attendance-clock`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify(payload),
    }
  );

  const body = await res.json();
  if (!res.ok) throw new Error(body.error || "Attendance action failed");
  return body;
}

export function useAttendance(weekStart?: Date) {
  const { user } = useAuth();
  const [currentLog, setCurrentLog] = useState<AttendanceLog | null>(null);
  const [weeklyLogs, setWeeklyLogs] = useState<AttendanceLog[]>([]);
  const [monthlyLogs, setMonthlyLogs] = useState<AttendanceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [clockType, setClockType] = useState<"payroll" | "billable">("payroll");
  // Server-provided timezone info for display
  const [employeeTimezone, setEmployeeTimezone] = useState<string | null>(null);
  const [employeeTimezoneAbbr, setEmployeeTimezoneAbbr] = useState<string | null>(null);

  const fetchCurrentLog = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("attendance_logs")
      .select("*")
      .eq("user_id", user.id)
      .is("clock_out", null)
      .order("clock_in", { ascending: false })
      .limit(1)
      .single();

    if (!error && data) {
      const log = data as AttendanceLog;
      if (log.pause_start && !log.pause_end) {
        log.status = "paused";
      } else if (log.break_start && !log.break_end) {
        log.status = "break";
      } else if (!log.clock_out) {
        log.status = "active";
      }
      setCurrentLog(log);
    } else {
      setCurrentLog(null);
    }
    setLoading(false);
  }, [user]);

  const fetchWeeklyLogs = useCallback(async () => {
    if (!user) return;

    const startDate =
      weekStart ||
      (() => {
        const today = new Date();
        const utcDay = today.getUTCDay();
        const diff = utcDay === 0 ? -6 : 1 - utcDay;
        const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + diff));
        return start;
      })();

    const endDate = new Date(Date.UTC(
      startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate() + 6,
      23, 59, 59, 999
    ));

    const { data, error } = await supabase
      .from("attendance_logs")
      .select("*")
      .eq("user_id", user.id)
      .gte("clock_in", startDate.toISOString())
      .lte("clock_in", endDate.toISOString())
      .order("clock_in", { ascending: false });

    if (!error && data) {
      setWeeklyLogs(data as AttendanceLog[]);
    }
  }, [user, weekStart]);

  const fetchMonthlyLogs = useCallback(async () => {
    if (!user) return;

    const today = new Date();
    const startOfMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    const endOfMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0, 23, 59, 59, 999));

    const { data, error } = await supabase
      .from("attendance_logs")
      .select("*")
      .eq("user_id", user.id)
      .gte("clock_in", startOfMonth.toISOString())
      .lte("clock_in", endOfMonth.toISOString())
      .order("clock_in", { ascending: false });

    if (!error && data) {
      setMonthlyLogs(data as AttendanceLog[]);
    }
  }, [user]);

  // Fetch employee timezone from DB on mount
  useEffect(() => {
    if (!user) return;
    (async () => {
      // Get profile -> employee -> timezone
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();
      if (profile) {
        const { data: emp } = await supabase
          .from("employees")
          .select("timezone")
          .eq("profile_id", profile.id)
          .single();
        if (emp?.timezone) {
          setEmployeeTimezone(emp.timezone);
          try {
            const abbr = new Intl.DateTimeFormat("en-US", {
              timeZone: emp.timezone,
              timeZoneName: "short",
            }).formatToParts(new Date()).find(p => p.type === "timeZoneName")?.value;
            setEmployeeTimezoneAbbr(abbr || emp.timezone);
          } catch {
            setEmployeeTimezoneAbbr(emp.timezone);
          }
        }
      }
    })();
  }, [user]);

  useEffect(() => {
    Promise.all([fetchCurrentLog(), fetchWeeklyLogs(), fetchMonthlyLogs()]);
  }, [fetchCurrentLog, fetchWeeklyLogs, fetchMonthlyLogs]);

  // 8-hour work duration reminder
  const reminderSentRef = useRef(false);

  useEffect(() => {
    if (!currentLog || !user) {
      reminderSentRef.current = false;
      return;
    }

    const checkWorkDuration = () => {
      if (reminderSentRef.current || !currentLog || currentLog.status === "paused" || currentLog.status === "break")
        return;

      const clockInTime = new Date(currentLog.clock_in).getTime();
      const now = Date.now();
      const breakMs = (currentLog.total_break_minutes || 0) * 60 * 1000;
      const pauseMs = (currentLog.total_pause_minutes || 0) * 60 * 1000;
      const netWorkMs = now - clockInTime - breakMs - pauseMs;

      const reminderThresholdMs = 470 * 60 * 1000;

      if (netWorkMs >= reminderThresholdMs) {
        reminderSentRef.current = true;
        toast({
          title: "⏰ 8-Hour Reminder",
          description: "You've been working for nearly 8 hours. Don't forget to clock out soon!",
        });

        supabase.rpc("create_notification", {
          p_user_id: user.id,
          p_title: "⏰ 8-Hour Work Reminder",
          p_message: "You've been working for nearly 8 hours. Don't forget to clock out in the next 10 minutes!",
          p_type: "attendance",
          p_link: "/attendance",
        });

        try {
          const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
          const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
          fetch(
            `https://${projectId}.supabase.co/functions/v1/send-attendance-reminder`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${anonKey}`,
              },
              body: JSON.stringify({ source: "client", user_id: user.id }),
            }
          ).catch((err) => console.error("Failed to trigger attendance reminder email:", err));
        } catch (err) {
          console.error("Failed to call send-attendance-reminder:", err);
        }
      }
    };

    checkWorkDuration();
    const interval = setInterval(checkWorkDuration, 60 * 1000);

    return () => clearInterval(interval);
  }, [currentLog, user]);

  /**
   * Clock In — calls server-side edge function.
   * Server determines the timestamp using UTC. Client sends NO timezone.
   */
  const clockIn = async (type: "payroll" | "billable" = "payroll", workMode: "wfo" | "wfh" = "wfo") => {
    if (!user) return;

    // Optional: gather geolocation for metadata (NOT for timezone)
    let locationName = "Office";
    if ("geolocation" in navigator) {
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
        });
        locationName = `${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`;
      } catch {
        // Location not available
      }
    }

    try {
      const result = await callAttendanceClock({
        action: "clock_in",
        clock_type: type,
        work_mode: workMode,
        location_name: locationName,
      });

      setCurrentLog(result.log as AttendanceLog);
      if (result.timezone) setEmployeeTimezone(result.timezone);
      if (result.timezone_abbr) setEmployeeTimezoneAbbr(result.timezone_abbr);

      toast({
        title: "Clocked In",
        description: `You are now tracking ${type} time (${workMode === "wfh" ? "Work From Home" : "Office"}) — ${result.local_time} ${result.timezone_abbr || ""}`,
      });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to clock in", variant: "destructive" });
    }
  };

  const clockOut = async () => {
    if (!user || !currentLog) return;

    try {
      const result = await callAttendanceClock({
        action: "clock_out",
        log_id: currentLog.id,
      });

      setCurrentLog(null);
      fetchWeeklyLogs();
      toast({
        title: "Clocked Out",
        description: `Your time has been recorded at ${result.local_time} ${result.timezone_abbr || ""}. All active logs have been closed.`,
      });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to clock out", variant: "destructive" });
    }
  };

  const startBreak = async () => {
    if (!user || !currentLog) return;

    try {
      const result = await callAttendanceClock({
        action: "start_break",
        log_id: currentLog.id,
      });

      setCurrentLog({ ...result.log, status: "break" } as AttendanceLog);
      toast({ title: "Break Started", description: "Enjoy your break!" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to start break", variant: "destructive" });
    }
  };

  const endBreak = async () => {
    if (!user || !currentLog || !currentLog.break_start) return;

    try {
      const result = await callAttendanceClock({
        action: "end_break",
        log_id: currentLog.id,
      });

      setCurrentLog({ ...result.log, status: "active" } as AttendanceLog);
      toast({ title: "Back to Work", description: `Break time: ${result.break_minutes} minutes` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to end break", variant: "destructive" });
    }
  };

  const startPause = async () => {
    if (!user || !currentLog) return;

    try {
      const result = await callAttendanceClock({
        action: "start_pause",
        log_id: currentLog.id,
      });

      setCurrentLog({ ...result.log, status: "paused" } as AttendanceLog);
      toast({ title: "Clock Paused", description: "Your time tracking is paused. Resume when you continue working." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to pause clock", variant: "destructive" });
    }
  };

  const endPause = async (newWorkMode?: "wfo" | "wfh") => {
    if (!user || !currentLog || !currentLog.pause_start) return;

    try {
      const result = await callAttendanceClock({
        action: "end_pause",
        log_id: currentLog.id,
        new_work_mode: newWorkMode,
      });

      setCurrentLog({ ...result.log, status: "active" } as AttendanceLog);
      toast({
        title: "Clock Resumed",
        description: `Pause time: ${result.pause_minutes} minutes${newWorkMode ? ` — now ${newWorkMode === "wfh" ? "Working From Home" : "Working From Office"}` : ""}`,
      });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to resume clock", variant: "destructive" });
    }
  };

  const status = useMemo(() => {
    if (!currentLog) return "out";
    if (currentLog.status === "paused") return "paused";
    if (currentLog.status === "break") return "break";
    return "in";
  }, [currentLog]);

  const monthlyHours = useMemo(() => {
    let totalMinutes = 0;
    monthlyLogs.forEach((log) => {
      if (log.clock_in && log.clock_out) {
        const start = new Date(log.clock_in);
        const end = new Date(log.clock_out);
        const breakMinutes = log.total_break_minutes || 0;
        const pauseMinutes = log.total_pause_minutes || 0;
        const diffMs = end.getTime() - start.getTime() - (breakMinutes + pauseMinutes) * 60 * 1000;
        totalMinutes += Math.max(0, diffMs / (1000 * 60));
      }
    });
    return Math.round((totalMinutes / 60) * 10) / 10;
  }, [monthlyLogs]);

  const getTimeBreakdown = useCallback((logs: AttendanceLog[]) => {
    let workMs = 0;
    let breakMinTotal = 0;
    let pauseMinTotal = 0;

    logs.forEach((log) => {
      if (!log.clock_in) return;
      const start = new Date(log.clock_in);
      const end = log.clock_out ? new Date(log.clock_out) : new Date();
      const breakMin = log.total_break_minutes || 0;
      const pauseMin = log.total_pause_minutes || 0;
      const netMs = end.getTime() - start.getTime() - (breakMin + pauseMin) * 60 * 1000;
      workMs += Math.max(0, netMs);
      breakMinTotal += breakMin;
      pauseMinTotal += pauseMin;
    });

    return {
      net_work_hours: Math.round((workMs / (1000 * 60 * 60)) * 10) / 10,
      total_break_time: breakMinTotal,
      total_pause_time: pauseMinTotal,
    };
  }, []);

  const refetch = useCallback(() => {
    Promise.all([fetchCurrentLog(), fetchWeeklyLogs(), fetchMonthlyLogs()]);
  }, [fetchCurrentLog, fetchWeeklyLogs, fetchMonthlyLogs]);

  return {
    currentLog,
    weeklyLogs,
    monthlyLogs,
    loading,
    clockType,
    setClockType,
    clockIn,
    clockOut,
    startBreak,
    endBreak,
    startPause,
    endPause,
    status,
    monthlyHours,
    getTimeBreakdown,
    refetch,
    /** Employee's profile timezone (IANA), e.g. "Asia/Kathmandu" */
    employeeTimezone,
    /** Short abbreviation, e.g. "NPT" */
    employeeTimezoneAbbr,
  };
}
