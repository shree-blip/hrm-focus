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
      // Ensure status is correctly determined from actual break_start/break_end and pause_start/pause_end values
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
    const startDate = weekStart || (() => {
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

  // Listen for real-time updates on attendance_logs (for auto clock-out)
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('attendance-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'attendance_logs',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          const updated = payload.new as AttendanceLog;
          // Check if this was an auto clock-out
          if (updated.status === 'auto_clocked_out') {
            toast({
              title: "Auto Clock Out",
              description: "You were automatically clocked out after 8 hours. Please clock in again if still working.",
              variant: "destructive",
            });
            setCurrentLog(null);
            fetchWeeklyLogs();
            fetchMonthlyLogs();
          } else {
            // Normal update
            fetchCurrentLog();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchCurrentLog, fetchWeeklyLogs, fetchMonthlyLogs]);

  const clockIn = async (type: "payroll" | "billable" = "payroll") => {
    if (!user) return;

    // Check geofencing (simplified - just check if location is available)
    let locationName = "Office";
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
      })
      .select()
      .single();

    if (error) {
      toast({ title: "Error", description: "Failed to clock in", variant: "destructive" });
    } else {
      setCurrentLog(data as AttendanceLog);
      toast({ title: "Clocked In", description: `You are now tracking ${type} time.` });
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
      setCurrentLog(null);
      fetchWeeklyLogs();
      toast({ title: "Clocked Out", description: "Your time has been recorded." });
    }
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
    }
  };

  const pauseClock = async () => {
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
      toast({ title: "Clock Paused", description: "Your session is paused. Resume when ready." });
    }
  };

  const resumeClock = async () => {
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
      toast({ title: "Clock Resumed", description: `Paused for ${pauseMinutes} minutes. Back to work!` });
    }
  };

  const getStatus = () => {
    if (!currentLog) return "out";
    if (currentLog.status === "paused") return "paused";
    if (currentLog.status === "break") return "break";
    return "in";
  };

  // Calculate monthly hours
  const getMonthlyHours = () => {
    let totalMinutes = 0;
    monthlyLogs.forEach(log => {
      if (log.clock_in && log.clock_out) {
        const start = new Date(log.clock_in);
        const end = new Date(log.clock_out);
        const breakMinutes = log.total_break_minutes || 0;
        const pauseMinutes = log.total_pause_minutes || 0;
        const diffMs = end.getTime() - start.getTime() - (breakMinutes * 60 * 1000) - (pauseMinutes * 60 * 1000);
        totalMinutes += diffMs / (1000 * 60);
      }
    });
    return Math.round(totalMinutes / 60 * 10) / 10;
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
    pauseClock,
    resumeClock,
    status: getStatus(),
    monthlyHours: getMonthlyHours(),
    refetch: () => {
      fetchCurrentLog();
      fetchWeeklyLogs();
      fetchMonthlyLogs();
    },
  };
}
