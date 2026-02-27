import { useState, useEffect, useCallback, useRef } from "react";
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

export function useAttendance(weekStart?: Date) {
  const { user } = useAuth();
  const [currentLog, setCurrentLog] = useState<AttendanceLog | null>(null);
  const [weeklyLogs, setWeeklyLogs] = useState<AttendanceLog[]>([]);
  const [monthlyLogs, setMonthlyLogs] = useState<AttendanceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [clockType, setClockType] = useState<"payroll" | "billable">("payroll");

  const fetchCurrentLog = useCallback(async () => {
    if (!user) return;

    // Fetch any active attendance log regardless of date (persists across sessions)
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
      // Ensure status is correctly determined from actual break_start/break_end/pause_start/pause_end values
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

    // Use provided weekStart or default to current week
    const startDate =
      weekStart ||
      (() => {
        const today = new Date();
        const start = new Date(today);
        start.setDate(today.getDate() - today.getDay() + 1); // Monday
        start.setHours(0, 0, 0, 0);
        return start;
      })();

    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6); // Sunday
    endDate.setHours(23, 59, 59, 999);

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

  // Fetch current month's attendance for payroll
  const fetchMonthlyLogs = useCallback(async () => {
    if (!user) return;

    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);

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

  useEffect(() => {
    fetchCurrentLog();
    fetchWeeklyLogs();
    fetchMonthlyLogs();
  }, [fetchCurrentLog, fetchWeeklyLogs, fetchMonthlyLogs]);

  // 8-hour work duration reminder (fires 10 min before 8 hours = at 7h50m)
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

      // 7 hours 50 minutes = 470 minutes
      const reminderThresholdMs = 470 * 60 * 1000;

      if (netWorkMs >= reminderThresholdMs) {
        reminderSentRef.current = true;
        toast({
          title: "⏰ 8-Hour Reminder",
          description: "You've been working for nearly 8 hours. Consider clocking out soon!",
        });

        supabase.from("notifications").insert({
          user_id: user.id,
          title: "⏰ 8-Hour Work Reminder",
          message: "You've been working for nearly 8 hours. Consider clocking out in the next 10 minutes.",
          type: "attendance",
          link: "/attendance",
        });
      }
    };

    // Check immediately and then every minute
    checkWorkDuration();
    const interval = setInterval(checkWorkDuration, 60 * 1000);

    return () => clearInterval(interval);
  }, [currentLog, user]);

  // Track the ID of the work log that was auto-paused by the current attendance session
  const autoPausedLogIdRef = useRef<string | null>(null);

  // Auto-pause ONLY the currently active (in_progress) work log when attendance is paused/on break
  const autoPauseWorkLogs = async (reason: string) => {
    if (!user) return;
    try {
      // Find the single most-recent in_progress work log (the "current" one)
      const { data: activeLogs } = await supabase
        .from("work_logs")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "in_progress")
        .is("end_time", null)
        .order("created_at", { ascending: false })
        .limit(1);

      if (activeLogs && activeLogs.length > 0) {
        const logId = activeLogs[0].id;
        autoPausedLogIdRef.current = logId;
        await supabase
          .from("work_logs")
          .update({
            status: "on_hold",
            pause_start: new Date().toISOString(),
          })
          .eq("id", logId);
      }
    } catch (err) {
      console.error("Error auto-pausing work logs:", err);
    }
  };

  // Auto-resume ONLY the work log that was auto-paused by this attendance session
  const autoResumeWorkLogs = async () => {
    if (!user) return;

    try {
      // Find the most recent on_hold work log (the one auto-paused by clock)
      const { data: log } = await supabase
        .from("work_logs")
        .select("id, pause_start, total_pause_minutes")
        .eq("user_id", user.id)
        .eq("status", "on_hold")
        .is("end_time", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (log) {
        const now = new Date();
        let totalPause = log.total_pause_minutes || 0;
        if (log.pause_start) {
          const pauseStart = new Date(log.pause_start);
          totalPause += Math.round((now.getTime() - pauseStart.getTime()) / 60000);
        }
        await supabase
          .from("work_logs")
          .update({
            status: "in_progress",
            pause_end: now.toISOString(),
            total_pause_minutes: totalPause,
          })
          .eq("id", log.id);
      }
    } catch (err) {
      console.error("Error auto-resuming work logs:", err);
    } finally {
      autoPausedLogIdRef.current = null;
    }
  };

  const clockIn = async (type: "payroll" | "billable" = "payroll", workLocation: "office" | "home" = "office") => {
    if (!user) return;

    // Check geofencing (simplified - just check if location is available)
    let locationName = workLocation === "home" ? "Home" : "Office";
    if ("geolocation" in navigator) {
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
        });
        locationName = `${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`;
      } catch {
        // Location not available, proceed anyway
      }
    }

    const { data, error } = await supabase
      .from("attendance_logs")
      .insert({
        user_id: user.id,
        clock_in: new Date().toISOString(),
        clock_type: type,
        status: "active",
        location_name: locationName,
        work_location: workLocation,
      })
      .select()
      .single();

    if (error) {
      toast({ title: "Error", description: "Failed to clock in", variant: "destructive" });
    } else {
      setCurrentLog(data as AttendanceLog);
      toast({ title: "Clocked In", description: `You are now tracking ${type} time.` });

      // Create notification for clock-in
      await supabase.from("notifications").insert({
        user_id: user.id,
        title: "⏰ Clocked In",
        message: `You clocked in at ${new Date().toLocaleTimeString()} (${type} time).`,
        type: "attendance",
        link: "/attendance",
      });
    }
  };

  const clockOut = async () => {
    if (!user || !currentLog) return;

    const clockOutTime = new Date();
    const clockOutIso = clockOutTime.toISOString();
    const clockOutHHMM = `${String(clockOutTime.getHours()).padStart(2, "0")}:${String(clockOutTime.getMinutes()).padStart(2, "0")}`;

    // Finalize any active pause or break before clocking out
    let finalBreakMinutes = currentLog.total_break_minutes || 0;
    let finalPauseMinutes = currentLog.total_pause_minutes || 0;
    const updatePayload: Record<string, unknown> = {
      clock_out: clockOutIso,
      status: "completed",
    };

    if (currentLog.pause_start && !currentLog.pause_end) {
      const pauseStart = new Date(currentLog.pause_start);
      const additionalPause = Math.round((clockOutTime.getTime() - pauseStart.getTime()) / 60000);
      finalPauseMinutes += additionalPause;
      updatePayload.pause_end = clockOutIso;
      updatePayload.total_pause_minutes = finalPauseMinutes;
    }

    if (currentLog.break_start && !currentLog.break_end) {
      const breakStart = new Date(currentLog.break_start);
      const additionalBreak = Math.round((clockOutTime.getTime() - breakStart.getTime()) / 60000);
      finalBreakMinutes += additionalBreak;
      updatePayload.break_end = clockOutIso;
      updatePayload.total_break_minutes = finalBreakMinutes;
    }

    const { error } = await supabase.from("attendance_logs").update(updatePayload).eq("id", currentLog.id);

    if (error) {
      toast({ title: "Error", description: "Failed to clock out", variant: "destructive" });
      return;
    }

    // Auto-close ALL active work logs for this user (any status that isn't completed)
    try {
      const { data: activeLogs } = await supabase
        .from("work_logs")
        .select("id, start_time, pause_start, total_pause_minutes, status")
        .eq("user_id", user.id)
        .is("end_time", null)
        .in("status", ["in_progress", "on_hold", "pending", "break", "paused"]);

      if (activeLogs && activeLogs.length > 0) {
        for (const log of activeLogs) {
          let totalPause = log.total_pause_minutes || 0;

          // If currently paused, finalize pause duration
          if (log.pause_start && (log.status === "on_hold" || log.status === "paused")) {
            const pauseStart = new Date(log.pause_start);
            totalPause += Math.round((clockOutTime.getTime() - pauseStart.getTime()) / 60000);
          }

          // Calculate time_spent_minutes from start_time to clockOutHHMM minus pauses
          let timeSpent = 0;
          if (log.start_time) {
            const [sH, sM] = log.start_time.split(":").map(Number);
            const [eH, eM] = clockOutHHMM.split(":").map(Number);
            const startMin = sH * 60 + sM;
            const endMin = eH * 60 + eM;
            const raw = endMin < startMin ? 24 * 60 - startMin + endMin : endMin - startMin;
            timeSpent = Math.max(0, raw - totalPause);
          }

          await supabase
            .from("work_logs")
            .update({
              end_time: clockOutHHMM,
              status: "completed",
              total_pause_minutes: totalPause,
              pause_end: log.pause_start ? clockOutIso : undefined,
              time_spent_minutes: timeSpent,
            })
            .eq("id", log.id);
        }
      }
    } catch (err) {
      console.error("Error auto-closing work logs on clock out:", err);
    }

    setCurrentLog(null);
    fetchWeeklyLogs();
    toast({ title: "Clocked Out", description: "Your time has been recorded. All active logs have been closed." });

    // Create notification for clock-out
    await supabase.from("notifications").insert({
      user_id: user.id,
      title: "⏰ Clocked Out",
      message: `You clocked out at ${clockOutTime.toLocaleTimeString()}. Your time has been recorded.`,
      type: "attendance",
      link: "/attendance",
    });
  };

  const startBreak = async () => {
    if (!user || !currentLog) return;

    const { data, error } = await supabase
      .from("attendance_logs")
      .update({
        break_start: new Date().toISOString(),
        break_end: null,
        status: "break",
      })
      .eq("id", currentLog.id)
      .select()
      .single();

    if (error) {
      toast({ title: "Error", description: "Failed to start break", variant: "destructive" });
    } else {
      setCurrentLog({ ...data, status: "break" } as AttendanceLog);
      toast({ title: "Break Started", description: "Enjoy your break!" });

      // Auto-pause all active work logs
      await autoPauseWorkLogs("break");

      await supabase.from("notifications").insert({
        user_id: user.id,
        title: "☕ Break Started",
        message: `You started a break at ${new Date().toLocaleTimeString()}.`,
        type: "attendance",
        link: "/attendance",
      });
    }
  };

  const endBreak = async () => {
    if (!user || !currentLog || !currentLog.break_start) return;

    const breakStart = new Date(currentLog.break_start);
    const breakEnd = new Date();
    const breakMinutes = Math.round((breakEnd.getTime() - breakStart.getTime()) / 60000);

    const { data, error } = await supabase
      .from("attendance_logs")
      .update({
        break_end: breakEnd.toISOString(),
        total_break_minutes: (currentLog.total_break_minutes || 0) + breakMinutes,
        status: "active",
      })
      .eq("id", currentLog.id)
      .select()
      .single();

    if (error) {
      toast({ title: "Error", description: "Failed to end break", variant: "destructive" });
    } else {
      setCurrentLog({ ...data, status: "active" } as AttendanceLog);
      toast({ title: "Back to Work", description: `Break time: ${breakMinutes} minutes` });

      // Auto-resume all paused work logs
      await autoResumeWorkLogs();

      await supabase.from("notifications").insert({
        user_id: user.id,
        title: "💼 Break Ended",
        message: `You resumed work after a ${breakMinutes} minute break.`,
        type: "attendance",
        link: "/attendance",
      });
    }
  };

  const startPause = async () => {
    if (!user || !currentLog) return;

    const { data, error } = await supabase
      .from("attendance_logs")
      .update({
        pause_start: new Date().toISOString(),
        pause_end: null,
        status: "paused",
      })
      .eq("id", currentLog.id)
      .select()
      .single();

    if (error) {
      toast({ title: "Error", description: "Failed to pause clock", variant: "destructive" });
    } else {
      setCurrentLog({ ...data, status: "paused" } as AttendanceLog);
      toast({ title: "Clock Paused", description: "Your time tracking is paused. Resume when you continue working." });

      // Auto-pause all active work logs
      await autoPauseWorkLogs("paused");

      await supabase.from("notifications").insert({
        user_id: user.id,
        title: "⏸️ Clock Paused",
        message: `You paused your clock at ${new Date().toLocaleTimeString()}.`,
        type: "attendance",
        link: "/attendance",
      });
    }
  };

  const endPause = async () => {
    if (!user || !currentLog || !currentLog.pause_start) return;

    const pauseStart = new Date(currentLog.pause_start);
    const pauseEnd = new Date();
    const pauseMinutes = Math.round((pauseEnd.getTime() - pauseStart.getTime()) / 60000);

    const { data, error } = await supabase
      .from("attendance_logs")
      .update({
        pause_end: pauseEnd.toISOString(),
        total_pause_minutes: (currentLog.total_pause_minutes || 0) + pauseMinutes,
        status: "active",
      })
      .eq("id", currentLog.id)
      .select()
      .single();

    if (error) {
      toast({ title: "Error", description: "Failed to resume clock", variant: "destructive" });
    } else {
      setCurrentLog({ ...data, status: "active" } as AttendanceLog);
      toast({ title: "Clock Resumed", description: `Pause time: ${pauseMinutes} minutes` });

      // Auto-resume all paused work logs
      await autoResumeWorkLogs();

      await supabase.from("notifications").insert({
        user_id: user.id,
        title: "▶️ Clock Resumed",
        message: `You resumed work after a ${pauseMinutes} minute pause.`,
        type: "attendance",
        link: "/attendance",
      });
    }
  };

  const getStatus = () => {
    if (!currentLog) return "out";
    if (currentLog.status === "paused") return "paused";
    if (currentLog.status === "break") return "break";
    return "in";
  };

  /**
   * Calculates net work hours for the month.
   * Formula: (clock_out - clock_in) - total_break_minutes - total_pause_minutes
   * Both breaks (lunch/rest) and pauses (hybrid commute transitions) are non-working states.
   */
  const getMonthlyHours = () => {
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
  };

  /**
   * Returns a detailed breakdown for admin/reporting:
   * net_work_hours, total_break_time (min), total_pause_time (min)
   */
  const getTimeBreakdown = (logs: AttendanceLog[]) => {
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
  };

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
    status: getStatus(),
    monthlyHours: getMonthlyHours(),
    /** Returns net_work_hours, total_break_time (min), total_pause_time (min) for any log array */
    getTimeBreakdown,
    refetch: () => {
      fetchCurrentLog();
      fetchWeeklyLogs();
      fetchMonthlyLogs();
    },
  };
}
