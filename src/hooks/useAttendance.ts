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
  clock_type: "payroll" | "billable";
  status: "active" | "break" | "completed";
  location_name?: string;
}

export function useAttendance() {
  const { user } = useAuth();
  const [currentLog, setCurrentLog] = useState<AttendanceLog | null>(null);
  const [weeklyLogs, setWeeklyLogs] = useState<AttendanceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [clockType, setClockType] = useState<"payroll" | "billable">("payroll");

  const fetchCurrentLog = useCallback(async () => {
    if (!user) return;

    const today = new Date().toISOString().split("T")[0];
    const { data, error } = await supabase
      .from("attendance_logs")
      .select("*")
      .eq("user_id", user.id)
      .gte("clock_in", `${today}T00:00:00`)
      .is("clock_out", null)
      .order("clock_in", { ascending: false })
      .limit(1)
      .single();

    if (!error && data) {
      const log = data as AttendanceLog;
      // Ensure status is correctly determined from actual break_start/break_end values
      // If break_start exists and break_end is null, user is on break
      // If break_end exists or no break_start, user is active
      if (log.break_start && !log.break_end) {
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

    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    
    const { data, error } = await supabase
      .from("attendance_logs")
      .select("*")
      .eq("user_id", user.id)
      .gte("clock_in", startOfWeek.toISOString())
      .order("clock_in", { ascending: false });

    if (!error && data) {
      setWeeklyLogs(data as AttendanceLog[]);
    }
  }, [user]);

  useEffect(() => {
    fetchCurrentLog();
    fetchWeeklyLogs();
  }, [fetchCurrentLog, fetchWeeklyLogs]);

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

  const getStatus = () => {
    if (!currentLog) return "out";
    if (currentLog.status === "break") return "break";
    return "in";
  };

  return {
    currentLog,
    weeklyLogs,
    loading,
    clockType,
    setClockType,
    clockIn,
    clockOut,
    startBreak,
    endBreak,
    status: getStatus(),
    refetch: () => {
      fetchCurrentLog();
      fetchWeeklyLogs();
    },
  };
}
