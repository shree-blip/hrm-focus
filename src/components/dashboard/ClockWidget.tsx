import { useState, useEffect } from "react";
import { Clock, Play, Square, Coffee, Loader2, Briefcase, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useAttendance } from "@/hooks/useAttendance";
import { format, startOfWeek, endOfWeek } from "date-fns";

export function ClockWidget() {
  const {
    currentLog,
    weeklyLogs,
    monthlyHours,
    loading,
    clockType,
    setClockType,
    clockIn,
    clockOut,
    startBreak,
    endBreak,
    startPause,
    endPause,
    status: clockStatus,
  } = useAttendance();

  const [elapsedTime, setElapsedTime] = useState("00:00:00");

  // Update elapsed time every second
  useEffect(() => {
    if (clockStatus === "out" || !currentLog) {
      setElapsedTime("00:00:00");
      return;
    }

    const updateElapsed = () => {
      const now = new Date();
      const clockInTime = new Date(currentLog.clock_in);
      let elapsed = now.getTime() - clockInTime.getTime();

      // Subtract total break time
      const totalBreakMs = (currentLog.total_break_minutes || 0) * 60 * 1000;
      elapsed -= totalBreakMs;

      // Subtract total pause time
      const totalPauseMs = ((currentLog as any).total_pause_minutes || 0) * 60 * 1000;
      elapsed -= totalPauseMs;

      // If currently on break, subtract current break time
      if (clockStatus === "break" && currentLog.break_start) {
        const breakStart = new Date(currentLog.break_start);
        elapsed -= now.getTime() - breakStart.getTime();
      }

      // If currently paused, subtract current pause time
      if (clockStatus === "paused" && (currentLog as any).pause_start) {
        const pauseStart = new Date((currentLog as any).pause_start);
        elapsed -= now.getTime() - pauseStart.getTime();
      }

      // Ensure we don't show negative time
      elapsed = Math.max(0, elapsed);

      const hours = Math.floor(elapsed / (1000 * 60 * 60));
      const minutes = Math.floor((elapsed % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((elapsed % (1000 * 60)) / 1000);

      setElapsedTime(
        `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`,
      );
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [clockStatus, currentLog]);

  const handleClockIn = async () => {
    await clockIn(clockType);
  };

  const handleClockOut = async () => {
    await clockOut();
  };

  const handleBreak = async () => {
    if (clockStatus === "break") {
      await endBreak();
    } else {
      await startBreak();
    }
  };

  const handlePause = async () => {
    if (clockStatus === "paused") {
      await endPause();
    } else {
      await startPause();
    }
  };

  // Calculate today's hours from logs (excluding breaks and pauses)
  const getTodayHours = () => {
    const today = format(new Date(), "yyyy-MM-dd");
    const todayLogs = weeklyLogs.filter((log) => {
      const logDate = format(new Date(log.clock_in), "yyyy-MM-dd");
      return logDate === today;
    });

    let totalMinutes = 0;
    todayLogs.forEach((log) => {
      const start = new Date(log.clock_in);
      const end = log.clock_out ? new Date(log.clock_out) : new Date();
      const breakMinutes = log.total_break_minutes || 0;
      const pauseMinutes = (log as any).total_pause_minutes || 0;
      const diffMs = end.getTime() - start.getTime() - breakMinutes * 60 * 1000 - pauseMinutes * 60 * 1000;
      totalMinutes += Math.max(0, diffMs / (1000 * 60));
    });

    const hours = Math.floor(totalMinutes / 60);
    const mins = Math.round(totalMinutes % 60);
    return `${hours}h ${mins}m`;
  };

  // Calculate weekly hours (excluding breaks and pauses)
  const getWeeklyHours = () => {
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

    let totalMinutes = 0;
    weeklyLogs.forEach((log) => {
      const logDate = new Date(log.clock_in);
      if (logDate >= weekStart && logDate <= weekEnd) {
        const start = new Date(log.clock_in);
        const end = log.clock_out ? new Date(log.clock_out) : new Date();
        const breakMinutes = log.total_break_minutes || 0;
        const pauseMinutes = (log as any).total_pause_minutes || 0;
        const diffMs = end.getTime() - start.getTime() - breakMinutes * 60 * 1000 - pauseMinutes * 60 * 1000;
        totalMinutes += Math.max(0, diffMs / (1000 * 60));
      }
    });

    const hours = Math.floor(totalMinutes / 60);
    const mins = Math.round(totalMinutes % 60);
    return `${hours}h ${mins}m`;
  };

  // Calculate utilization (assuming 8h target per day, 40h per week)
  const getUtilization = () => {
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

    let totalMinutes = 0;
    weeklyLogs.forEach((log) => {
      const logDate = new Date(log.clock_in);
      if (logDate >= weekStart && logDate <= weekEnd) {
        const start = new Date(log.clock_in);
        const end = log.clock_out ? new Date(log.clock_out) : new Date();
        const breakMinutes = log.total_break_minutes || 0;
        const pauseMinutes = (log as any).total_pause_minutes || 0;
        const diffMs = end.getTime() - start.getTime() - breakMinutes * 60 * 1000 - pauseMinutes * 60 * 1000;
        totalMinutes += Math.max(0, diffMs / (1000 * 60));
      }
    });

    const targetMinutes = 40 * 60; // 40 hours per week
    const utilization = Math.round((totalMinutes / targetMinutes) * 100);
    return Math.min(utilization, 100);
  };

  if (loading) {
    return (
      <Card
        className="overflow-hidden animate-slide-up opacity-0"
        style={{ animationDelay: "200ms", animationFillMode: "forwards" }}
      >
        <CardContent className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  const clockInTime = currentLog ? new Date(currentLog.clock_in) : null;

  return (
    <Card
      className="overflow-hidden animate-slide-up opacity-0"
      style={{ animationDelay: "200ms", animationFillMode: "forwards" }}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Time Tracker
          </CardTitle>
          <Badge
            variant="outline"
            className={cn(
              "font-medium",
              clockStatus === "in" && "border-success text-success bg-success/10",
              clockStatus === "out" && "border-muted-foreground text-muted-foreground",
              clockStatus === "break" && "border-warning text-warning bg-warning/10",
              clockStatus === "paused" && "border-info text-info bg-info/10",
            )}
          >
            {clockStatus === "in" && (currentLog?.clock_type === "billable" ? "Billable" : "Active")}
            {clockStatus === "out" && "Not Clocked In"}
            {clockStatus === "break" && "On Break"}
            {clockStatus === "paused" && "Paused"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Clock Type Selector */}
        {clockStatus === "out" && (
          <div className="flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-muted-foreground" />
            <Select value={clockType} onValueChange={(v) => setClockType(v as "payroll" | "billable")}>
              <SelectTrigger className="flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="payroll">Payroll Time</SelectItem>
                {/* <SelectItem value="billable">Billable Time</SelectItem> */}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Timer Display */}
        <div className="text-center py-6 rounded-lg bg-secondary/50">
          <p className="text-5xl font-display font-bold tracking-wider text-foreground">{elapsedTime}</p>
          {clockInTime && (
            <p className="text-sm text-muted-foreground mt-2">
              Clocked in at {clockInTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
              {currentLog?.clock_type === "billable" && " (Billable)"}
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 flex-wrap">
          {clockStatus === "out" ? (
            <Button onClick={handleClockIn} className="flex-1 gap-2" size="lg">
              <Play className="h-4 w-4" />
              Clock In
            </Button>
          ) : (
            <>
              <Button
                onClick={handleBreak}
                variant={clockStatus === "break" ? "default" : "secondary"}
                className="flex-1 gap-2"
                size="lg"
                disabled={clockStatus === "paused"}
              >
                <Coffee className="h-4 w-4" />
                {clockStatus === "break" ? "Resume" : "Break"}
              </Button>
              <Button
                onClick={handlePause}
                variant={clockStatus === "paused" ? "default" : "outline"}
                className={cn(
                  "flex-1 gap-2",
                  clockStatus === "paused" && "bg-info hover:bg-info/90 text-info-foreground",
                )}
                size="lg"
                disabled={clockStatus === "break"}
              >
                <Pause className="h-4 w-4" />
                {clockStatus === "paused" ? "Resume" : "Pause"}
              </Button>
              <Button onClick={handleClockOut} variant="destructive" className="flex-1 gap-2" size="lg">
                <Square className="h-4 w-4" />
                Clock Out
              </Button>
            </>
          )}
        </div>

        {/* Today's Summary */}
        <div className="grid grid-cols-3 gap-3 pt-2">
          <div className="text-center p-3 rounded-lg bg-accent/50">
            <p className="text-lg font-semibold text-foreground">{getTodayHours()}</p>
            <p className="text-xs text-muted-foreground">Today</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-accent/50">
            <p className="text-lg font-semibold text-foreground">{getWeeklyHours()}</p>
            <p className="text-xs text-muted-foreground">This Week</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-accent/50">
            <p className="text-lg font-semibold text-foreground">{monthlyHours}h</p>
            <p className="text-xs text-muted-foreground">This Month</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
