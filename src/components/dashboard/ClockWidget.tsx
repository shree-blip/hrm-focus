import { useState, useEffect, useMemo, useCallback, useRef, memo } from "react";
import { Clock, Play, Square, Coffee, Loader2, Briefcase, Pause, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useTimeTracker } from "@/contexts/TimeTrackerContext";
import { format, startOfWeek, endOfWeek } from "date-fns";
import { AlertTriangle, X } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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

function formatElapsed(ms: number): string {
  const total = Math.max(0, ms);
  const hours = Math.floor(total / 3600000);
  const minutes = Math.floor((total % 3600000) / 60000);
  const seconds = Math.floor((total % 60000) / 1000);
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

function computeHours(logs: any[]): string {
  let totalMinutes = 0;
  logs.forEach((log) => {
    const start = new Date(log.clock_in);
    const end = log.clock_out ? new Date(log.clock_out) : new Date();
    const breakMin = log.total_break_minutes || 0;
    const pauseMin = log.total_pause_minutes || 0;
    const diffMs = end.getTime() - start.getTime() - (breakMin + pauseMin) * 60000;
    totalMinutes += Math.max(0, diffMs / 60000);
  });
  return `${Math.floor(totalMinutes / 60)}h ${Math.round(totalMinutes % 60)}m`;
}

export const ClockWidget = memo(function ClockWidget() {
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
    actionInProgress,
    employeeTimezoneAbbr,
  } = useTimeTracker();

  const isBusy = !!actionInProgress;
  const typedCurrentLog = currentLog as AttendanceLogWithPause | null;

  // ── Elapsed timer using ref to avoid stale closures ──
  const [elapsedTime, setElapsedTime] = useState("00:00:00");
  const logRef = useRef(typedCurrentLog);
  const statusRef = useRef(clockStatus);
  logRef.current = typedCurrentLog;
  statusRef.current = clockStatus;

  useEffect(() => {
    if (clockStatus === "out" || !typedCurrentLog) {
      setElapsedTime("00:00:00");
      return;
    }

    const tick = () => {
      const log = logRef.current;
      const st = statusRef.current;
      if (!log) return;

      // Freeze displayed time while paused or on break
      if (st === "paused" || st === "break") return;

      const now = Date.now();
      let elapsed = now - new Date(log.clock_in).getTime();
      elapsed -= (log.total_break_minutes || 0) * 60000;
      elapsed -= (log.total_pause_minutes || 0) * 60000;

      setElapsedTime(formatElapsed(elapsed));
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
    // Only restart interval when the log identity or status category changes
  }, [typedCurrentLog?.id, clockStatus]);

  // ── Dialogs ──
  const [showClockOutDialog, setShowClockOutDialog] = useState(false);
  const [showResumeLocationDialog, setShowResumeLocationDialog] = useState(false);

  // ── Memoized handlers ──
  const handleClockOutClick = useCallback(() => setShowClockOutDialog(true), []);
  const handleConfirmClockOut = useCallback(async () => {
    setShowClockOutDialog(false);
    await clockOut();
  }, [clockOut]);

  const handleBreak = useCallback(async () => {
    if (clockStatus === "break") await endBreak();
    else await startBreak();
  }, [clockStatus, endBreak, startBreak]);

  const handlePause = useCallback(async () => {
    if (clockStatus === "paused") setShowResumeLocationDialog(true);
    else await startPause();
  }, [clockStatus, startPause]);

  const handleResumeWithLocation = useCallback(
    async (workMode: "wfo" | "wfh") => {
      setShowResumeLocationDialog(false);
      await endPause(workMode);
    },
    [endPause],
  );

  // ── Memoized computed values ──
  const todayStr = format(new Date(), "yyyy-MM-dd");

  const todayHours = useMemo(() => {
    const todayLogs = weeklyLogs.filter((log) => format(new Date(log.clock_in), "yyyy-MM-dd") === todayStr);
    return computeHours(todayLogs);
  }, [weeklyLogs, todayStr]);

  const weeklyHours = useMemo(() => {
    const now = new Date();
    const ws = startOfWeek(now, { weekStartsOn: 1 });
    const we = endOfWeek(now, { weekStartsOn: 1 });
    const filtered = weeklyLogs.filter((log) => {
      const d = new Date(log.clock_in);
      return d >= ws && d <= we;
    });
    return computeHours(filtered);
  }, [weeklyLogs]);

  const clockInTime = typedCurrentLog ? new Date(typedCurrentLog.clock_in) : null;

  if (loading) {
    return (
      <Card
        className="overflow-hidden animate-slide-up opacity-0"
        style={{ animationDelay: "200ms", animationFillMode: "forwards" }}
      >
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-5 w-28" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col items-center gap-3">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-10 w-full rounded-lg" />
          <div className="flex justify-between">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-12" />
          </div>
          <Skeleton className="h-2 w-full rounded-full" />
        </CardContent>
      </Card>
    );
  }

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
            {clockStatus === "in" && (typedCurrentLog?.clock_type === "billable" ? "Billable" : "Active")}
            {clockStatus === "out" && "Not Clocked In"}
            {clockStatus === "break" && "On Break"}
            {clockStatus === "paused" && "Paused"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
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
        <div className="text-center py-6 rounded-lg bg-secondary/50">
          <p className="text-5xl font-display font-bold tracking-wider text-foreground">{elapsedTime}</p>
          {clockInTime && (
            <p className="text-sm text-muted-foreground mt-2">
              Clocked in at {clockInTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
              {typedCurrentLog?.clock_type === "billable" && " (Billable)"}
            </p>
          )}
          {clockStatus === "paused" && typedCurrentLog?.pause_start && (
            <p className="text-xs text-info mt-1">
              Paused since{" "}
              {new Date(typedCurrentLog.pause_start).toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          )}
          {employeeTimezoneAbbr && clockStatus !== "out" && (
            <p className="text-xs text-muted-foreground mt-1.5 flex items-center justify-center gap-1">
              <Clock className="h-3 w-3" />
              Time zone: {employeeTimezoneAbbr}
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 flex-wrap">
          {clockStatus === "out" ? (
            <div className="grid grid-cols-2 gap-2 w-full">
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <Button onClick={() => clockIn(clockType, "wfo")} className="gap-2" size="lg" disabled={isBusy}>
                    {actionInProgress === "clock_in" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                    Clock IN (WFO)
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="font-medium">
                  Working from office
                </TooltipContent>
              </Tooltip>
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <Button
                    onClick={() => clockIn(clockType, "wfh")}
                    variant="outline"
                    className="gap-2 border-blue-300 text-blue-600 hover:bg-blue-50"
                    size="lg"
                    disabled={isBusy}
                  >
                    {actionInProgress === "clock_in" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                    Clock IN (WFH)
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="font-medium">
                  Working from home
                </TooltipContent>
              </Tooltip>
            </div>
          ) : (
            <>
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <Button
                    onClick={handleBreak}
                    variant="secondary"
                    className={cn(
                      "flex-1 gap-2",
                      clockStatus === "break"
                        ? "bg-amber-500 hover:bg-amber-600 text-white dark:bg-amber-600 dark:hover:bg-amber-700"
                        : "bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:hover:bg-amber-900/60",
                    )}
                    size="lg"
                    disabled={clockStatus === "paused" || isBusy}
                  >
                    {actionInProgress === "start_break" || actionInProgress === "end_break" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Coffee className="h-4 w-4" />
                    )}
                    {clockStatus === "break" ? "Resume" : "Break"}
                  </Button>
                </TooltipTrigger>
                <TooltipContent
                  side="bottom"
                  sideOffset={10}
                  className="font-medium text-xs px-4 py-2.5 max-w-[220px] text-center bg-[#4FB0D6] text-black rounded-lg shadow-lg border-0"
                >
                  {clockStatus === "break" ? "End break and resume working" : "Taking a short break at your location"}
                </TooltipContent>
              </Tooltip>
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <Button
                    onClick={handlePause}
                    variant="secondary"
                    className={cn(
                      "flex-1 gap-2",
                      clockStatus === "paused"
                        ? "bg-indigo-500 hover:bg-indigo-600 text-white dark:bg-indigo-600 dark:hover:bg-indigo-700"
                        : "bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300 dark:hover:bg-indigo-900/60",
                    )}
                    size="lg"
                    disabled={clockStatus === "break" || isBusy}
                  >
                    {actionInProgress === "start_pause" || actionInProgress === "end_pause" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Pause className="h-4 w-4" />
                    )}
                    {clockStatus === "paused" ? "Resume" : "Pause"}
                  </Button>
                </TooltipTrigger>
                <TooltipContent
                  side="bottom"
                  sideOffset={12}
                  className="
    max-w-[250px]
    rounded-2xl
    border border-white/20
    bg-gradient-to-br from-[#67C9EC] via-[#4FB0D6] to-[#3E9FC3]
    px-4 py-3
    text-center
    text-xs font-semibold leading-5 text-slate-900
    shadow-[0_14px_40px_rgba(0,0,0,0.16)]
    ring-1 ring-white/10
    backdrop-blur-lg
  "
                >
                  {clockStatus === "paused"
                    ? "Click to resume work from a new location"
                    : "You’re leaving your current location — continue later"}
                </TooltipContent>
              </Tooltip>

              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <Button
                    onClick={handleClockOutClick}
                    variant="destructive"
                    className="flex-1 gap-2"
                    size="lg"
                    disabled={isBusy}
                  >
                    {actionInProgress === "clock_out" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
                    Clock Out
                  </Button>
                </TooltipTrigger>
                <TooltipContent
                  side="bottom"
                  sideOffset={12}
                  className="
    max-w-[250px]
    rounded-2xl
    border border-white/20
    bg-gradient-to-br from-[#67C9EC] via-[#4FB0D6] to-[#3E9FC3]
    px-4 py-3
    text-center
    text-xs font-semibold leading-5 text-slate-900
    shadow-[0_14px_40px_rgba(0,0,0,0.16)]
    ring-1 ring-white/10
    backdrop-blur-lg
  "
                >
                  End your shift for the day
                </TooltipContent>
              </Tooltip>
            </>
          )}
        </div>

        {/* Today's Summary */}
        <div className="grid grid-cols-3 gap-3 pt-2">
          <div className="text-center p-3 rounded-lg bg-accent/50">
            <p className="text-lg font-semibold text-foreground">{todayHours}</p>
            <p className="text-xs text-muted-foreground">Today</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-accent/50">
            <p className="text-lg font-semibold text-foreground">{weeklyHours}</p>
            <p className="text-xs text-muted-foreground">This Week</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-accent/50">
            <p className="text-lg font-semibold text-foreground">{monthlyHours}h</p>
            <p className="text-xs text-muted-foreground">This Month</p>
          </div>
        </div>

        {/* Clock Out Confirmation Dialog */}
        <AlertDialog open={showClockOutDialog} onOpenChange={setShowClockOutDialog}>
          <AlertDialogContent className="max-w-md">
            <AlertDialogHeader className="space-y-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
                <AlertTriangle className="h-7 w-7 text-amber-600" />
              </div>
              <AlertDialogTitle className="text-center text-xl">End Your Workday?</AlertDialogTitle>
              <AlertDialogDescription className="text-center space-y-3">
                <p className="text-base">
                  You are about to <span className="font-semibold text-foreground">Clock Out</span>, which will
                  permanently end your shift for today.
                </p>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-left">
                  <div className="flex items-start gap-2">
                    <Pause className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-blue-800">
                      If you are taking a short break or switching location, please use <strong>Pause</strong> instead.
                    </p>
                  </div>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col sm:flex-row gap-2 mt-4">
              <AlertDialogCancel className="flex-1 gap-2">
                <X className="h-4 w-4" />
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmClockOut}
                className="flex-1 gap-2 bg-rose-600 hover:bg-rose-700 text-white"
              >
                <Square className="h-4 w-4 fill-current" />
                Confirm Clock Out
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        {/* Resume Location Dialog */}
        <AlertDialog open={showResumeLocationDialog} onOpenChange={setShowResumeLocationDialog}>
          <AlertDialogContent className="max-w-md">
            <AlertDialogHeader className="space-y-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-100">
                <Briefcase className="h-7 w-7 text-blue-600" />
              </div>
              <AlertDialogTitle className="text-center text-xl">Where are you working from?</AlertDialogTitle>
              <AlertDialogDescription className="text-center text-base">
                You're about to resume your shift. Please select your current work location.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="flex flex-col gap-3 mt-4">
              <Button onClick={() => handleResumeWithLocation("wfo")} className="w-full gap-2 h-12 text-base" size="lg">
                <Briefcase className="h-5 w-5" />
                Office (WFO)
              </Button>
              <Button
                onClick={() => handleResumeWithLocation("wfh")}
                variant="outline"
                className="w-full gap-2 h-12 text-base border-blue-300 text-blue-600 hover:bg-blue-50"
                size="lg"
              >
                <Home className="h-5 w-5" />
                Home (WFH)
              </Button>
            </div>
            <AlertDialogFooter className="mt-3">
              <AlertDialogCancel className="w-full gap-2">
                <X className="h-4 w-4" />
                Stay Paused
              </AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
});
