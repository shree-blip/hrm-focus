import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import type { RealtimeChannel } from "@supabase/supabase-js";

export interface AttendanceLog {
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
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [employeeTimezone, setEmployeeTimezone] = useState<string | null>(null);
  const [employeeTimezoneAbbr, setEmployeeTimezoneAbbr] = useState<string | null>(null);

  // Track previous log for rollback on optimistic failure
  const prevLogRef = useRef<AttendanceLog | null>(null);

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
        return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + diff));
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

  // Initial data fetch
  useEffect(() => {
    Promise.all([fetchCurrentLog(), fetchWeeklyLogs(), fetchMonthlyLogs()]);
  }, [fetchCurrentLog, fetchWeeklyLogs, fetchMonthlyLogs]);

  // ═══════════════════════════════════════════════════════════════════
  // Helper: derive status from raw DB row and set as currentLog
  // ═══════════════════════════════════════════════════════════════════
  const applyLogFromDB = useCallback((row: any) => {
    if (!row || row.clock_out || row.status === "completed" || row.status === "auto_clocked_out") {
      setCurrentLog(null);
      return;
    }
    const log = row as AttendanceLog;
    if (log.pause_start && !log.pause_end) log.status = "paused";
    else if (log.break_start && !log.break_end) log.status = "break";
    else log.status = "active";
    setCurrentLog(log);
  }, []);

  // ═══════════════════════════════════════════════════════════════════
  // Broadcast channel ref — used to send instant state to other devices
  // ═══════════════════════════════════════════════════════════════════
  const broadcastChannelRef = useRef<RealtimeChannel | null>(null);

  const broadcastState = useCallback((log: AttendanceLog | null) => {
    const ch = broadcastChannelRef.current;
    if (!ch) return;
    ch.send({
      type: "broadcast",
      event: "attendance_state",
      payload: { log, ts: Date.now() },
    });
  }, []);

  // ═══════════════════════════════════════════════════════════════════
  // REAL-TIME SUBSCRIPTION — postgres_changes (backup, 1-3s delay)
  // + Broadcast channel (instant, <500ms)
  // + Visibility change handler (re-fetch on tab focus / app resume)
  // ═══════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!user) return;

    // --- 1. Postgres changes (backup) ---
    const pgChannel = supabase
      .channel(`attendance-pg-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "attendance_logs",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const { eventType, new: newRecord } = payload;
          if (eventType === "DELETE") {
            setCurrentLog(null);
            return;
          }
          const row = newRecord as any;
          if (row.clock_out || row.status === "completed" || row.status === "auto_clocked_out") {
            setCurrentLog(null);
            fetchWeeklyLogs();
            fetchMonthlyLogs();
          } else {
            applyLogFromDB(row);
          }
        }
      )
      .subscribe();

    // --- 2. Broadcast channel (instant cross-device) ---
    const bcChannel = supabase
      .channel(`attendance-bc-${user.id}`)
      .on("broadcast", { event: "attendance_state" }, ({ payload }) => {
        if (!payload) return;
        const { log } = payload as { log: AttendanceLog | null };
        if (log === null) {
          setCurrentLog(null);
          fetchWeeklyLogs();
          fetchMonthlyLogs();
        } else {
          applyLogFromDB(log);
        }
      })
      .subscribe();

    broadcastChannelRef.current = bcChannel;

    // --- 3. Visibility change: re-fetch on tab focus / app resume ---
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        fetchCurrentLog();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    // Also handle mobile app resume via focus
    window.addEventListener("focus", handleVisibility);

    return () => {
      supabase.removeChannel(pgChannel);
      supabase.removeChannel(bcChannel);
      broadcastChannelRef.current = null;
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleVisibility);
    };
  }, [user, fetchCurrentLog, fetchWeeklyLogs, fetchMonthlyLogs, applyLogFromDB]);

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

  // ═══════════════════════════════════════════════════════════════════
  // OPTIMISTIC ACTIONS — instant UI, server confirms/reconciles
  // ═══════════════════════════════════════════════════════════════════

  const clockIn = async (type: "payroll" | "billable" = "payroll", workMode: "wfo" | "wfh" = "wfo") => {
    if (!user || actionInProgress) return;
    setActionInProgress("clock_in");

    // Optimistic: immediately show as clocked in
    const optimisticLog: AttendanceLog = {
      id: "optimistic-" + Date.now(),
      clock_in: new Date().toISOString(),
      clock_out: null,
      break_start: null,
      break_end: null,
      total_break_minutes: 0,
      pause_start: null,
      pause_end: null,
      total_pause_minutes: 0,
      clock_type: type,
      status: "active",
      location_name: workMode === "wfh" ? "Home" : "Office",
    };
    prevLogRef.current = currentLog;
    setCurrentLog(optimisticLog);

    // Don't block on geolocation — fire and forget
    let locationName = workMode === "wfh" ? "Home" : "Office";
    const geoPromise = ("geolocation" in navigator)
      ? new Promise<string>((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve(`${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`),
            () => resolve(locationName),
            { timeout: 3000 }
          );
        })
      : Promise.resolve(locationName);

    try {
      locationName = await geoPromise;
      const result = await callAttendanceClock({
        action: "clock_in",
        clock_type: type,
        work_mode: workMode,
        location_name: locationName,
      });

      // Reconcile with server truth
      const serverLog = result.log as AttendanceLog;
      applyLogFromDB(serverLog);
      broadcastState(serverLog);
      if (result.timezone) setEmployeeTimezone(result.timezone);
      if (result.timezone_abbr) setEmployeeTimezoneAbbr(result.timezone_abbr);

      toast({
        title: "Clocked In",
        description: `Now tracking ${type} time (${workMode === "wfh" ? "WFH" : "Office"}) — ${result.local_time} ${result.timezone_abbr || ""}`,
      });
    } catch (err: any) {
      // Rollback optimistic
      setCurrentLog(prevLogRef.current);
      toast({ title: "Error", description: err.message || "Failed to clock in", variant: "destructive" });
    } finally {
      setActionInProgress(null);
    }
  };

  const clockOut = async () => {
    if (!user || !currentLog || actionInProgress) return;
    setActionInProgress("clock_out");

    // Optimistic: immediately show as clocked out
    prevLogRef.current = currentLog;
    setCurrentLog(null);

    try {
      const result = await callAttendanceClock({
        action: "clock_out",
        log_id: prevLogRef.current!.id,
      });

      broadcastState(null);
      fetchWeeklyLogs();
      fetchMonthlyLogs();
      toast({
        title: "Clocked Out",
        description: `Time recorded at ${result.local_time} ${result.timezone_abbr || ""}`,
      });
    } catch (err: any) {
      // Rollback
      setCurrentLog(prevLogRef.current);
      toast({ title: "Error", description: err.message || "Failed to clock out", variant: "destructive" });
    } finally {
      setActionInProgress(null);
    }
  };

  const startBreak = async () => {
    if (!user || !currentLog || actionInProgress) return;
    setActionInProgress("start_break");

    // Optimistic
    prevLogRef.current = { ...currentLog };
    setCurrentLog({ ...currentLog, status: "break", break_start: new Date().toISOString(), break_end: null });

    try {
      const result = await callAttendanceClock({
        action: "start_break",
        log_id: currentLog.id,
      });
      const serverLog = { ...result.log, status: "break" } as AttendanceLog;
      applyLogFromDB(serverLog);
      broadcastState(serverLog);
      toast({ title: "Break Started", description: "Enjoy your break!" });
    } catch (err: any) {
      setCurrentLog(prevLogRef.current);
      toast({ title: "Error", description: err.message || "Failed to start break", variant: "destructive" });
    } finally {
      setActionInProgress(null);
    }
  };

  const endBreak = async () => {
    if (!user || !currentLog || !currentLog.break_start || actionInProgress) return;
    setActionInProgress("end_break");

    prevLogRef.current = { ...currentLog };
    setCurrentLog({ ...currentLog, status: "active", break_start: null, break_end: new Date().toISOString() });

    try {
      const result = await callAttendanceClock({
        action: "end_break",
        log_id: currentLog.id,
      });
      setCurrentLog({ ...result.log, status: "active" } as AttendanceLog);
      toast({ title: "Back to Work", description: `Break time: ${result.break_minutes} minutes` });
    } catch (err: any) {
      setCurrentLog(prevLogRef.current);
      toast({ title: "Error", description: err.message || "Failed to end break", variant: "destructive" });
    } finally {
      setActionInProgress(null);
    }
  };

  const startPause = async () => {
    if (!user || !currentLog || actionInProgress) return;
    setActionInProgress("start_pause");

    prevLogRef.current = { ...currentLog };
    setCurrentLog({ ...currentLog, status: "paused", pause_start: new Date().toISOString(), pause_end: null });

    try {
      const result = await callAttendanceClock({
        action: "start_pause",
        log_id: currentLog.id,
      });
      setCurrentLog({ ...result.log, status: "paused" } as AttendanceLog);
      toast({ title: "Clock Paused", description: "Your time tracking is paused." });
    } catch (err: any) {
      setCurrentLog(prevLogRef.current);
      toast({ title: "Error", description: err.message || "Failed to pause clock", variant: "destructive" });
    } finally {
      setActionInProgress(null);
    }
  };

  const endPause = async (newWorkMode?: "wfo" | "wfh") => {
    if (!user || !currentLog || !currentLog.pause_start || actionInProgress) return;
    setActionInProgress("end_pause");

    prevLogRef.current = { ...currentLog };
    setCurrentLog({ ...currentLog, status: "active", pause_start: null, pause_end: new Date().toISOString() });

    try {
      const result = await callAttendanceClock({
        action: "end_pause",
        log_id: currentLog.id,
        new_work_mode: newWorkMode,
      });
      setCurrentLog({ ...result.log, status: "active" } as AttendanceLog);
      toast({
        title: "Clock Resumed",
        description: `Pause time: ${result.pause_minutes} minutes${newWorkMode ? ` — now ${newWorkMode === "wfh" ? "WFH" : "Office"}` : ""}`,
      });
    } catch (err: any) {
      setCurrentLog(prevLogRef.current);
      toast({ title: "Error", description: err.message || "Failed to resume clock", variant: "destructive" });
    } finally {
      setActionInProgress(null);
    }
  };

  const status: "in" | "out" | "break" | "paused" = useMemo(() => {
    if (!currentLog) return "out" as const;
    if (currentLog.status === "paused") return "paused" as const;
    if (currentLog.status === "break") return "break" as const;
    return "in" as const;
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
    actionInProgress,
    employeeTimezone,
    employeeTimezoneAbbr,
  };
}
