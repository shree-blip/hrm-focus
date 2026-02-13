import { useState, useEffect } from "react";
import { Clock, Play, Square, Coffee, Loader2, Briefcase, Pause, Target, Home, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useAttendance } from "@/hooks/useAttendance";
import { format, startOfWeek, endOfWeek } from "date-fns";

interface AttendanceLogWithPause {
  id: string;
  clock_in: string;
  clock_out: string | null;
  clock_type: "payroll" | "billable";
  break_start: string | null;
  break_end: string | null;
  total_break_minutes: number;
  pause_start: string | null;
  pause_end: string | null;
  total_pause_minutes: number;
}

const TARGET_WORK_HOURS = 8;
const TARGET_WORK_MINUTES = TARGET_WORK_HOURS * 60;

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
  const [workMinutes, setWorkMinutes] = useState(0);

  const typedCurrentLog = currentLog as AttendanceLogWithPause | null;

  // Calculate current break time (ongoing + completed)
  const getCurrentBreakMinutes = () => {
    if (!typedCurrentLog) return 0;
    let total = typedCurrentLog.total_break_minutes || 0;

    if (clockStatus === "break" && typedCurrentLog.break_start) {
      const breakStart = new Date(typedCurrentLog.break_start);
      total += Math.floor((new Date().getTime() - breakStart.getTime()) / 60000);
    }
    return total;
  };

  // Calculate current pause time (for display only)
  const getCurrentPauseMinutes = () => {
    if (!typedCurrentLog) return 0;
    let total = typedCurrentLog.total_pause_minutes || 0;

    if (clockStatus === "paused" && typedCurrentLog.pause_start) {
      const pauseStart = new Date(typedCurrentLog.pause_start);
      total += Math.floor((new Date().getTime() - pauseStart.getTime()) / 60000);
    }
    return total;
  };

  // Update elapsed WORK time every second
  useEffect(() => {
    if (clockStatus === "out" || !typedCurrentLog) {
      setElapsedTime("00:00:00");
      setWorkMinutes(0);
      return;
    }

    const updateElapsed = () => {
      const now = new Date();
      const clockInTime = new Date(typedCurrentLog.clock_in);

      // Start with total elapsed time
      let elapsed = now.getTime() - clockInTime.getTime();

      // Subtract completed pause time (clock was stopped)
      const totalPauseMs = (typedCurrentLog.total_pause_minutes || 0) * 60 * 1000;
      elapsed -= totalPauseMs;

      // Subtract current ongoing pause
      if (clockStatus === "paused" && typedCurrentLog.pause_start) {
        const pauseStart = new Date(typedCurrentLog.pause_start);
        elapsed -= now.getTime() - pauseStart.getTime();
      }

      // Now elapsed = active clock time
      // Subtract break time to get work time
      const totalBreakMs = (typedCurrentLog.total_break_minutes || 0) * 60 * 1000;
      let workTime = elapsed - totalBreakMs;

      // Subtract current ongoing break
      if (clockStatus === "break" && typedCurrentLog.break_start) {
        const breakStart = new Date(typedCurrentLog.break_start);
        workTime -= now.getTime() - breakStart.getTime();
      }

      workTime = Math.max(0, workTime);

      const hours = Math.floor(workTime / (1000 * 60 * 60));
      const minutes = Math.floor((workTime % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((workTime % (1000 * 60)) / 1000);

      setElapsedTime(
        `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`,
      );

      setWorkMinutes(Math.floor(workTime / 60000));
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [clockStatus, typedCurrentLog]);

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

  const formatMinutes = (minutes: number): string => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const getTodayHours = () => {
    const today = format(new Date(), "yyyy-MM-dd");
    const todayLogs = weeklyLogs.filter((log) => {
      const logDate = format(new Date(log.clock_in), "yyyy-MM-dd");
      return logDate === today;
    });

    let totalMinutes = 0;
    todayLogs.forEach((log) => {
      const typedLog = log as AttendanceLogWithPause;
      const start = new Date(typedLog.clock_in);
      const end = typedLog.clock_out ? new Date(typedLog.clock_out) : new Date();
      const pauseMinutes = typedLog.total_pause_minutes || 0;
      const breakMinutes = typedLog.total_break_minutes || 0;
      // Active time minus breaks = work time
      const elapsedMs = end.getTime() - start.getTime();
      const activeMs = elapsedMs - pauseMinutes * 60 * 1000;
      const workMs = activeMs - breakMinutes * 60 * 1000;
      totalMinutes += Math.max(0, workMs / (1000 * 60));
    });

    const hours = Math.floor(totalMinutes / 60);
    const mins = Math.round(totalMinutes % 60);
    return `${hours}h ${mins}m`;
  };

  const getWeeklyHours = () => {
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

    let totalMinutes = 0;
    weeklyLogs.forEach((log) => {
      const typedLog = log as AttendanceLogWithPause;
      const logDate = new Date(typedLog.clock_in);
      if (logDate >= weekStart && logDate <= weekEnd) {
        const start = new Date(typedLog.clock_in);
        const end = typedLog.clock_out ? new Date(typedLog.clock_out) : new Date();
        const pauseMinutes = typedLog.total_pause_minutes || 0;
        const breakMinutes = typedLog.total_break_minutes || 0;
        const elapsedMs = end.getTime() - start.getTime();
        const activeMs = elapsedMs - pauseMinutes * 60 * 1000;
        const workMs = activeMs - breakMinutes * 60 * 1000;
        totalMinutes += Math.max(0, workMs / (1000 * 60));
      }
    });

    const hours = Math.floor(totalMinutes / 60);
    const mins = Math.round(totalMinutes % 60);
    return `${hours}h ${mins}m`;
  };

  const getProgressPercent = () => {
    return Math.min(100, Math.round((workMinutes / TARGET_WORK_MINUTES) * 100));
  };

  const getRemainingTime = () => {
    const remaining = TARGET_WORK_MINUTES - workMinutes;
    if (remaining <= 0) return "Complete!";
    return formatMinutes(remaining);
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

  const clockInTime = typedCurrentLog ? new Date(typedCurrentLog.clock_in) : null;
  const currentBreakMinutes = getCurrentBreakMinutes();
  const currentPauseMinutes = getCurrentPauseMinutes();
  const progressPercent = getProgressPercent();

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
            {clockStatus === "in" && "Working"}
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
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Timer Display */}
        <div className="text-center py-4 rounded-lg bg-secondary/50">
          <p className="text-4xl sm:text-5xl font-display font-bold tracking-wider text-foreground">{elapsedTime}</p>
          <p className="text-xs text-muted-foreground mt-1">Work Time (breaks deducted)</p>
          {clockInTime && (
            <p className="text-sm text-muted-foreground mt-2">
              Clocked in at {clockInTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
          {clockStatus === "paused" && typedCurrentLog?.pause_start && (
            <p className="text-xs text-info mt-1 flex items-center justify-center gap-1">
              <Home className="h-3 w-3" />
              Paused since{" "}
              {new Date(typedCurrentLog.pause_start).toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          )}
          {clockStatus === "break" && typedCurrentLog?.break_start && (
            <p className="text-xs text-warning mt-1 flex items-center justify-center gap-1">
              <Coffee className="h-3 w-3" />
              Break started at{" "}
              {new Date(typedCurrentLog.break_start).toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          )}
        </div>

        {/* Progress toward 8-hour target */}
        {clockStatus !== "out" && (
          <div className="space-y-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                <span className="font-medium">Daily Target (8h)</span>
              </div>
              <span className="font-semibold text-primary">{progressPercent}%</span>
            </div>
            <Progress value={progressPercent} className="h-2" />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{formatMinutes(workMinutes)} worked</span>
              <span>
                {getRemainingTime()} {progressPercent < 100 ? "remaining" : ""}
              </span>
            </div>
          </div>
        )}

        {/* Break & Pause Info - Only show when relevant */}
        {clockStatus !== "out" &&
          (currentBreakMinutes > 0 ||
            currentPauseMinutes > 0 ||
            clockStatus === "break" ||
            clockStatus === "paused") && (
            <div className="grid grid-cols-2 gap-2">
              {/* Break Time (deducted from work) */}
              <div
                className={cn(
                  "p-3 rounded-lg border",
                  clockStatus === "break" ? "bg-warning/10 border-warning/30" : "bg-accent/50 border-border",
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Coffee
                    className={cn("h-4 w-4", clockStatus === "break" ? "text-warning" : "text-muted-foreground")}
                  />
                  <span className="text-xs font-medium">Break</span>
                </div>
                <p className={cn("text-lg font-bold", clockStatus === "break" ? "text-warning" : "text-foreground")}>
                  {formatMinutes(currentBreakMinutes)}
                </p>
                <p className="text-[10px] text-muted-foreground">Deducted from work</p>
              </div>

              {/* Pause Time (clock stopped) */}
              <div
                className={cn(
                  "p-3 rounded-lg border",
                  clockStatus === "paused" ? "bg-info/10 border-info/30" : "bg-accent/50 border-border",
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Pause className={cn("h-4 w-4", clockStatus === "paused" ? "text-info" : "text-muted-foreground")} />
                  <span className="text-xs font-medium">Paused</span>
                </div>
                <p className={cn("text-lg font-bold", clockStatus === "paused" ? "text-info" : "text-foreground")}>
                  {formatMinutes(currentPauseMinutes)}
                </p>
                <p className="text-[10px] text-muted-foreground">Clock stopped</p>
              </div>
            </div>
          )}

        {/* Action Buttons */}
        <div className="space-y-2">
          {clockStatus === "out" ? (
            <Button onClick={handleClockIn} className="w-full gap-2" size="lg">
              <Play className="h-4 w-4" />
              Clock In
            </Button>
          ) : (
            <>
              <div className="flex gap-2">
                <Button
                  onClick={handleBreak}
                  variant={clockStatus === "break" ? "default" : "secondary"}
                  className={cn("flex-1 gap-2", clockStatus === "break" && "bg-warning hover:bg-warning/90")}
                  size="lg"
                  disabled={clockStatus === "paused"}
                >
                  <Coffee className="h-4 w-4" />
                  {clockStatus === "break" ? "End Break" : "Break"}
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
                  {clockStatus === "paused" ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                  {clockStatus === "paused" ? "Resume" : "Pause"}
                </Button>
              </div>
              <Button onClick={handleClockOut} variant="destructive" className="w-full gap-2" size="lg">
                <Square className="h-4 w-4" />
                Clock Out
              </Button>
            </>
          )}
        </div>

        {/* Explanation text for pause/break */}
        {clockStatus !== "out" && (
          <div className="text-[10px] text-muted-foreground text-center space-y-1 pt-2 border-t">
            <p>
              <Coffee className="h-3 w-3 inline mr-1" />
              <strong>Break:</strong> Lunch/rest - time deducted from work hours
            </p>
            <p>
              <Pause className="h-3 w-3 inline mr-1" />
              <strong>Pause:</strong> Stop clock (office → home) - resume when ready
            </p>
          </div>
        )}

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
