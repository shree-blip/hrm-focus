import { useState, useEffect, useCallback } from "react";
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

// Target work hours (breaks are deducted, pauses just stop the timer)
const TARGET_WORK_HOURS = 8;
const TARGET_WORK_MS = TARGET_WORK_HOURS * 60 * 60 * 1000;

export function useAttendance(weekStart?: Date) {
  const { user } = useAuth();
  const [currentLog, setCurrentLog] = useState<AttendanceLog | null>(null);
  const [weeklyLogs, setWeeklyLogs] = useState<AttendanceLog[]>([]);
  const [monthlyLogs, setMonthlyLogs] = useState<AttendanceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [clockType, setClockType] = useState<"payroll" | "billable">("payroll");

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
      // Determine status from actual field values
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
        const start = new Date(today);
        start.setDate(today.getDate() - today.getDay() + 1);
        start.setHours(0, 0, 0, 0);
        return start;
      })();

    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
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

  /**
   * Calculate WORK TIME for a log
   *
   * Logic:
   * - Work Time = (Clock Out or Now) - Clock In - Total Pause Time - Break Time
   * - Pause Time: Time when clock was paused (office to home transition) - NOT deducted from target
   * - Break Time: Lunch/rest breaks - DEDUCTED from work time
   *
   * For auto clock-out:
   * - We track "active work time" = total elapsed - pause time
   * - We deduct breaks from this to get "net work time"
   * - Auto clock-out when net work time >= 8 hours
   */
  const calculateWorkTimeMs = useCallback((log: AttendanceLog): number => {
    const now = new Date();
    const clockInTime = new Date(log.clock_in).getTime();

    // Total elapsed time since clock in
    let activeTime = now.getTime() - clockInTime;

    // Subtract completed pause time (time when clock was stopped)
    const totalPauseMs = (log.total_pause_minutes || 0) * 60 * 1000;
    activeTime -= totalPauseMs;

    // Subtract current ongoing pause time
    if (log.pause_start && !log.pause_end) {
      const pauseStart = new Date(log.pause_start).getTime();
      activeTime -= now.getTime() - pauseStart;
    }

    // Now activeTime = time the clock was actually running
    // Subtract break time to get net work time
    const totalBreakMs = (log.total_break_minutes || 0) * 60 * 1000;
    let netWorkTime = activeTime - totalBreakMs;

    // Subtract current ongoing break time
    if (log.break_start && !log.break_end) {
      const breakStart = new Date(log.break_start).getTime();
      netWorkTime -= now.getTime() - breakStart;
    }

    return Math.max(0, netWorkTime);
  }, []);

  // Auto clock-out after 8 hours of NET WORK TIME
  useEffect(() => {
    if (!user || !currentLog || currentLog.clock_out) return;

    // Don't auto clock-out while on break or paused
    if (currentLog.status === "break" || currentLog.status === "paused") {
      return;
    }

    const checkAndAutoClockOut = async () => {
      const workTimeMs = calculateWorkTimeMs(currentLog);

      if (workTimeMs >= TARGET_WORK_MS) {
        const { error } = await supabase
          .from("attendance_logs")
          .update({
            clock_out: new Date().toISOString(),
            notes: `[Auto clocked out after ${TARGET_WORK_HOURS} hours of work]`,
            status: "auto_clocked_out",
          })
          .eq("id", currentLog.id);

        if (!error) {
          await supabase.from("notifications").insert({
            user_id: user.id,
            title: "Auto Clock Out - 8 Hours Complete! 🎉",
            message: `You've completed ${TARGET_WORK_HOURS} hours of work today (excluding breaks). Great job! Clock in again if you need to continue.`,
            type: "info",
            link: "/attendance",
          });

          toast({
            title: "Auto Clock Out - Target Achieved! 🎉",
            description: `You've completed ${TARGET_WORK_HOURS} hours of work today!`,
          });

          setCurrentLog(null);
          fetchWeeklyLogs();
          fetchMonthlyLogs();
        }
        return true;
      }
      return false;
    };

    // Check immediately
    checkAndAutoClockOut().then((autoClocked) => {
      if (autoClocked) return;

      // Check every 30 seconds
      const interval = setInterval(() => {
        checkAndAutoClockOut().then((autoClocked) => {
          if (autoClocked) {
            clearInterval(interval);
          }
        });
      }, 30000);

      return () => clearInterval(interval);
    });
  }, [user, currentLog, calculateWorkTimeMs, fetchWeeklyLogs, fetchMonthlyLogs]);

  // Real-time updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("attendance-changes")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "attendance_logs",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const updated = payload.new as AttendanceLog;
          if (updated.status === "auto_clocked_out") {
            toast({
              title: "Auto Clock Out - Target Achieved! 🎉",
              description: `You've completed ${TARGET_WORK_HOURS} hours of work today.`,
            });
            setCurrentLog(null);
            fetchWeeklyLogs();
            fetchMonthlyLogs();
          } else {
            fetchCurrentLog();
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchCurrentLog, fetchWeeklyLogs, fetchMonthlyLogs]);

  const clockIn = async (type: "payroll" | "billable" = "payroll") => {
    if (!user) return;

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

    const { data, error } = await supabase
      .from("attendance_logs")
      .insert({
        user_id: user.id,
        clock_in: new Date().toISOString(),
        clock_type: type,
        status: "active",
        location_name: locationName,
        total_break_minutes: 0,
        total_pause_minutes: 0,
      })
      .select()
      .single();

    if (error) {
      toast({ title: "Error", description: "Failed to clock in", variant: "destructive" });
    } else {
      setCurrentLog(data as AttendanceLog);
      toast({ title: "Clocked In", description: `Tracking ${type} time. Target: ${TARGET_WORK_HOURS}h of work.` });
    }
  };

  const clockOut = async () => {
    if (!user || !currentLog) return;

    const { error } = await supabase
      .from("attendance_logs")
      .update({
        clock_out: new Date().toISOString(),
        status: "completed",
      })
      .eq("id", currentLog.id);

    if (error) {
      toast({ title: "Error", description: "Failed to clock out", variant: "destructive" });
    } else {
      const workTimeMs = calculateWorkTimeMs(currentLog);
      const workHours = Math.floor(workTimeMs / (1000 * 60 * 60));
      const workMinutes = Math.floor((workTimeMs % (1000 * 60 * 60)) / (1000 * 60));

      setCurrentLog(null);
      fetchWeeklyLogs();
      fetchMonthlyLogs();
      toast({
        title: "Clocked Out",
        description: `Total work: ${workHours}h ${workMinutes}m (breaks deducted).`,
      });
    }
  };

  // BREAK: Deducted from work time (lunch, rest)
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
      toast({ title: "Break Started ☕", description: "Break time will be deducted from your work hours." });
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
      const totalBreaks = (currentLog.total_break_minutes || 0) + breakMinutes;
      toast({
        title: "Break Ended",
        description: `Break: ${breakMinutes}m | Total breaks: ${totalBreaks}m (deducted from work time)`,
      });
    }
  };

  // PAUSE: Just stops the timer (office to home transition)
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
      toast({ title: "Error", description: "Failed to pause", variant: "destructive" });
    } else {
      setCurrentLog({ ...data, status: "paused" } as AttendanceLog);
      toast({
        title: "Clock Paused ⏸️",
        description: "Timer stopped. Resume when you continue working (e.g., from home).",
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
      toast({ title: "Error", description: "Failed to resume", variant: "destructive" });
    } else {
      setCurrentLog({ ...data, status: "active" } as AttendanceLog);
      toast({
        title: "Clock Resumed ▶️",
        description: `Paused for ${pauseMinutes}m. Timer is now running again.`,
      });
    }
  };

  const getStatus = () => {
    if (!currentLog) return "out";
    if (currentLog.status === "paused") return "paused";
    if (currentLog.status === "break") return "break";
    return "in";
  };

  // Calculate monthly hours (work time = elapsed - pauses - breaks)
  const getMonthlyHours = () => {
    let totalMinutes = 0;
    monthlyLogs.forEach((log) => {
      if (log.clock_in && log.clock_out) {
        const start = new Date(log.clock_in);
        const end = new Date(log.clock_out);
        const pauseMinutes = log.total_pause_minutes || 0;
        const breakMinutes = log.total_break_minutes || 0;
        // Active time = elapsed - pauses, then deduct breaks for net work time
        const elapsedMs = end.getTime() - start.getTime();
        const activeMs = elapsedMs - pauseMinutes * 60 * 1000;
        const workMs = activeMs - breakMinutes * 60 * 1000;
        totalMinutes += Math.max(0, workMs / (1000 * 60));
      }
    });
    return Math.round((totalMinutes / 60) * 10) / 10;
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
    refetch: () => {
      fetchCurrentLog();
      fetchWeeklyLogs();
      fetchMonthlyLogs();
    },
  };
}
