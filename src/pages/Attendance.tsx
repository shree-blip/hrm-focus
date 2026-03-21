import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Clock,
  Play,
  Square,
  Coffee,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  Briefcase,
  DollarSign,
  Pause,
  PenLine,
  Home,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTimeTracker } from "@/contexts/TimeTrackerContext";
import { useAttendanceAdjustments } from "@/hooks/useAttendanceAdjustments";
import { AdjustmentRequestDialog } from "@/components/attendance/AdjustmentRequestDialog";
import { ManagerAdjustmentPanel } from "@/components/attendance/ManagerAdjustmentPanel";
import { useAuth } from "@/contexts/AuthContext";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval, isToday } from "date-fns";
import { toast } from "@/hooks/use-toast";
import { AlertTriangle, X } from "lucide-react";
import { formatAttendanceTime, getWorkDate, getWorkDateDisplay, isNightShift, DEFAULT_TIMEZONE } from "@/utils/timezoneUtils";
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

const Attendance = () => {
  const { user, isManager, isLineManager, isAdmin, isVP } = useAuth();
  const [clockType, setClockType] = useState<"payroll" | "billable">("payroll");
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const currentDate = new Date();
  const [showClockOutDialog, setShowClockOutDialog] = useState(false);
  const [elapsedTime, setElapsedTime] = useState("00:00:00");
  const [showResumeLocationDialog, setShowResumeLocationDialog] = useState(false);
  const [adjustmentLog, setAdjustmentLog] = useState<{
    id: string;
    clock_in: string;
    clock_out: string | null;
    total_break_minutes: number;
    total_pause_minutes: number;
    clock_type: string;
    status: string;
  } | null>(null);

  const {
    currentLog,
    weeklyLogs: defaultWeeklyLogs,
    monthlyLogs,
    loading,
    clockIn,
    clockOut,
    startBreak,
    endBreak,
    startPause,
    endPause,
    monthlyHours,
    refetch,
    fetchWeeklyLogsForRange,
    status: sharedStatus,
    actionInProgress,
    employeeTimezone,
  } = useTimeTracker();

  // Week-specific logs for navigation (defaults to shared context's current week)
  const [navigatedWeeklyLogs, setNavigatedWeeklyLogs] = useState<any[] | null>(null);
  const isCurrentWeek = startOfWeek(new Date(), { weekStartsOn: 1 }).getTime() === currentWeekStart.getTime();
  const weeklyLogs = isCurrentWeek ? defaultWeeklyLogs : (navigatedWeeklyLogs ?? defaultWeeklyLogs);

  useEffect(() => {
    if (!isCurrentWeek) {
      fetchWeeklyLogsForRange(currentWeekStart).then(setNavigatedWeeklyLogs);
    } else {
      setNavigatedWeeklyLogs(null);
    }
  }, [currentWeekStart, isCurrentWeek, fetchWeeklyLogsForRange]);

  const { myRequests, teamRequests, submitRequest, reviewRequest, overrideRequest, getAdjustmentStatus } =
    useAttendanceAdjustments();

  // Use shared status from context
  const clockStatus = sharedStatus;

  // Elapsed time timer (like ClockWidget)
  useEffect(() => {
    if (clockStatus === "out" || !currentLog) {
      setElapsedTime("00:00:00");
      return;
    }

    const computeElapsed = () => {
      const now = new Date();
      const clockInTime = new Date(currentLog.clock_in);
      let elapsed = now.getTime() - clockInTime.getTime();

      const totalBreakMs = (currentLog.total_break_minutes || 0) * 60 * 1000;
      const totalPauseMs = ((currentLog as any).total_pause_minutes || 0) * 60 * 1000;
      elapsed -= totalBreakMs;
      elapsed -= totalPauseMs;

      if (clockStatus === "break" && currentLog.break_start) {
        elapsed -= now.getTime() - new Date(currentLog.break_start).getTime();
      }

      if (clockStatus === "paused" && (currentLog as any).pause_start) {
        elapsed -= now.getTime() - new Date((currentLog as any).pause_start).getTime();
      }

      elapsed = Math.max(0, elapsed);

      const hours = Math.floor(elapsed / (1000 * 60 * 60));
      const minutes = Math.floor((elapsed % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((elapsed % (1000 * 60)) / 1000);

      return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
    };

    // Compute once immediately
    setElapsedTime(computeElapsed());

    // If paused or on break, the value is frozen — no interval needed
    if (clockStatus === "break" || clockStatus === "paused") {
      return;
    }

    // Only tick when actively working
    const interval = setInterval(() => {
      setElapsedTime(computeElapsed());
    }, 1000);
    return () => clearInterval(interval);
  }, [clockStatus, currentLog]);

  /**
   * Net time worked today: elapsed - breaks - pauses.
   * Both break and pause are inactive (non-working) states.
   */
  const getTimeWorked = () => {
    if (!currentLog || !currentLog.clock_in) return "0h 0m";
    const start = new Date(currentLog.clock_in);
    const end = currentLog.clock_out ? new Date(currentLog.clock_out) : new Date();
    const breakMinutes = currentLog.total_break_minutes || 0;
    const pauseMinutes = (currentLog as any).total_pause_minutes || 0;
    // Subtract both break and pause — neither counts as active work time
    const diffMs = end.getTime() - start.getTime() - (breakMinutes + pauseMinutes) * 60 * 1000;
    const hours = Math.floor(Math.max(0, diffMs) / (1000 * 60 * 60));
    const minutes = Math.floor((Math.max(0, diffMs) % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  // Generate week days
  const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: currentWeekStart, end: weekEnd });

  /**
   * Net hours worked in a day: elapsed - breaks - pauses.
   * Pause (hybrid commute) is treated as non-working, same as break.
   */
  // Get the employee's timezone from context
  const tz = employeeTimezone || DEFAULT_TIMEZONE;

  const getHoursForDay = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    const dayLogs = weeklyLogs.filter((log) => {
      const logDate = getWorkDate(log.clock_in, tz);
      return logDate === dateStr;
    });

    let totalMinutes = 0;
    dayLogs.forEach((log) => {
      if (log.clock_in) {
        const start = new Date(log.clock_in);
        const end = log.clock_out ? new Date(log.clock_out) : new Date();
        const breakMinutes = log.total_break_minutes || 0;
        const pauseMinutes = (log as any).total_pause_minutes || 0;
        // Subtract both break and pause durations — both are inactive states
        const diffMs = end.getTime() - start.getTime() - (breakMinutes + pauseMinutes) * 60 * 1000;
        totalMinutes += Math.max(0, diffMs / (1000 * 60));
      }
    });

    return Math.round((totalMinutes / 60) * 10) / 10;
  };

  const handleClockIn = async () => {
    await clockIn(clockType);
  };

  const handleClockOut = async () => {
    await clockOut();
  };
  //handle clock out with confirmation dialog
  const handleClockOutClick = () => {
    setShowClockOutDialog(true);
  };

  const handleConfirmClockOut = async () => {
    setShowClockOutDialog(false);
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
      setShowResumeLocationDialog(true);
    } else {
      await startPause();
    }
  };

  const handleResumeWithLocation = async (workMode: "wfo" | "wfh") => {
    setShowResumeLocationDialog(false);
    await endPause(workMode);
  };

  const formatDuration = (minutes: number): string => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };
  const handleExport = () => {
    const fmt = (ts: string) => formatAttendanceTime(ts, tz);
    const headers = [
      "Work Date",
      "Clock In",
      "Clock In TZ",
      "Clock Out",
      "Clock Out TZ",
      "Break Duration",
      "Pause Duration",
      "Net Hours Worked",
      "Type",
      "Night Shift",
      "Clock In UTC",
      "Clock Out UTC",
    ];
    const rows = weeklyLogs.map((log) => {
      const clockIn = new Date(log.clock_in);
      const clockOut = log.clock_out ? new Date(log.clock_out) : null;
      const breakMinutes = log.total_break_minutes || 0;
      const pauseMinutes = (log as any).total_pause_minutes || 0;
      let hours = "-";
      if (clockOut) {
        const diffMs = clockOut.getTime() - clockIn.getTime();
        const netWorkMs = diffMs - (breakMinutes + pauseMinutes) * 60 * 1000;
        hours = `${(Math.max(0, netWorkMs) / (1000 * 60 * 60)).toFixed(2)}h`;
      }
      const inFmt = fmt(log.clock_in);
      const outFmt = log.clock_out ? fmt(log.clock_out) : null;
      const nightShift = log.clock_out ? isNightShift(log.clock_in, log.clock_out, tz) : false;
      return [
        getWorkDateDisplay(log.clock_in, tz),
        inFmt.localTime,
        inFmt.tzAbbr,
        outFmt ? outFmt.localTime : "-",
        outFmt ? outFmt.tzAbbr : "-",
        breakMinutes > 0 ? formatDuration(breakMinutes) : "-",
        pauseMinutes > 0 ? formatDuration(pauseMinutes) : "-",
        hours,
        log.clock_type || "payroll",
        nightShift ? "Yes" : "No",
        log.clock_in,
        log.clock_out || "-",
      ].join(",");
    });

    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance-${format(currentWeekStart, "yyyy-MM-dd")}.csv`;
    a.click();

    toast({
      title: "Export Complete",
      description: "Attendance report downloaded.",
    });
  };

  // Net weekly total = sum of (elapsed - breaks - pauses) per day
  const weeklyTotal = weekDays.reduce((acc, day) => acc + getHoursForDay(day), 0);

  // Set the target hours for comparison (e.g., 40 hours for the week)
  const targetHours = 40;
  const targetMet = Math.round((weeklyTotal / targetHours) * 100);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 animate-fade-in">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Attendance</h1>
          <p className="text-muted-foreground mt-1">Track time and manage attendance records</p>
        </div>
        <Button variant="outline" className="gap-2" onClick={handleExport}>
          <Download className="h-4 w-4" />
          Export Report
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Clock In/Out Card */}
        <Card
          className="lg:col-span-1 animate-slide-up opacity-0"
          style={{ animationDelay: "100ms", animationFillMode: "forwards" }}
        >
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              My Time Clock
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Clock Type Selector - only show when not clocked in */}
            {clockStatus === "out" && (
              <div className="flex items-center gap-2">
                <Select value={clockType} onValueChange={(v) => setClockType(v as "payroll" | "billable")}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="payroll">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4" />
                        Payroll Time
                      </div>
                    </SelectItem>
                    <SelectItem value="billable">
                      <div className="flex items-center gap-2">
                        <Briefcase className="h-4 w-4" />
                        Billable Time
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="text-center py-8 rounded-xl bg-secondary/50 border border-border">
              <p className="text-5xl font-display font-bold tracking-wider text-foreground">{elapsedTime}</p>

              {currentLog && !currentLog.clock_out && (
                <p className="text-sm text-muted-foreground mt-2">
                  Clocked in at{" "}
                  {new Date(currentLog.clock_in).toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              )}

              <p className="text-muted-foreground mt-1 text-sm">
                {currentDate.toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </p>

              <Badge
                variant="outline"
                className={cn(
                  "mt-3",
                  clockStatus === "in" && "border-success text-success bg-success/10",
                  clockStatus === "out" && "border-muted-foreground",
                  clockStatus === "break" && "border-warning text-warning bg-warning/10",
                  clockStatus === "paused" && "border-info text-info bg-info/10",
                )}
              >
                {clockStatus === "in" && `Working • ${getTimeWorked()}`}
                {clockStatus === "out" && "Not Clocked In"}
                {clockStatus === "break" && "On Break"}
                {clockStatus === "paused" && "Paused"}
              </Badge>

              {clockStatus === "paused" && (currentLog as any)?.pause_start && (
                <p className="text-xs text-info mt-1">
                  Paused since{" "}
                  {new Date((currentLog as any).pause_start).toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              )}
            </div>

            <div className="flex gap-2 flex-wrap">
              {clockStatus === "out" ? (
                <div className="grid grid-cols-2 gap-2 w-full">
                  <Button onClick={() => clockIn(clockType, "wfo")} className="flex-1 gap-2" size="lg">
                    <Play className="h-4 w-4" />
                    Clock IN (WFO)
                  </Button>
                  <Button
                    onClick={() => clockIn(clockType, "wfh")}
                    variant="outline"
                    className="flex-1 gap-2 border-blue-300 text-blue-600 hover:bg-blue-50"
                    size="lg"
                  >
                    <Play className="h-4 w-4" />
                    Clock IN (WFH)
                  </Button>
                </div>
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
                  <Button onClick={handleClockOutClick} variant="destructive" className="flex-1 gap-2" size="lg">
                    <Square className="h-4 w-4" />
                    Clock Out
                  </Button>
                </>
              )}
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
                          If you are taking a short break or switching location, please use <strong>Pause</strong>{" "}
                          instead.
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
                  <Button
                    onClick={() => handleResumeWithLocation("wfo")}
                    className="w-full gap-2 h-12 text-base"
                    size="lg"
                  >
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

        {/* Weekly Overview */}
        <Card
          className="lg:col-span-2 animate-slide-up opacity-0"
          style={{ animationDelay: "200ms", animationFillMode: "forwards" }}
        >
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="font-display text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Weekly Overview
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => {
                    const newWeek = subWeeks(currentWeekStart, 1);
                    setCurrentWeekStart(newWeek);
                  }}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium">
                  {format(currentWeekStart, "MMM d")} - {format(weekEnd, "MMM d")}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => {
                    const newWeek = addWeeks(currentWeekStart, 1);
                    setCurrentWeekStart(newWeek);
                  }}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-1 sm:gap-2">
              {weekDays.map((day, index) => {
                const hours = getHoursForDay(day);
                const dayName = format(day, "EEE");
                const isWeekend = index >= 5;

                return (
                  <div key={day.toISOString()} className="text-center min-w-0">
                    <p
                      className={cn(
                        "text-xs sm:text-sm font-medium mb-1 sm:mb-2",
                        isToday(day) ? "text-primary" : "text-muted-foreground",
                      )}
                    >
                      {format(day, "EEE").substring(0, 2)}
                    </p>
                    <div
                      className={cn(
                        "relative h-16 sm:h-24 rounded-lg bg-secondary/50 flex items-end justify-center pb-1 sm:pb-2 overflow-hidden",
                        !isWeekend && hours === 0 && !isToday(day) && "border-2 border-dashed border-destructive/30",
                        isToday(day) && "ring-2 ring-primary",
                      )}
                    >
                      {hours > 0 && (
                        <div
                          className="absolute bottom-0 left-0 right-0 bg-primary/80 transition-all duration-500"
                          style={{
                            height: `${Math.min((hours / 10) * 100, 100)}%`,
                          }}
                        />
                      )}
                      <span
                        className={cn(
                          "relative z-10 text-sm font-semibold",
                          hours > 0 ? "text-primary-foreground" : "text-muted-foreground",
                        )}
                      >
                        {hours > 0 ? `${hours}h` : "-"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
              <div className="text-center">
                <p className="text-2xl font-display font-bold">{weeklyTotal.toFixed(1)}h</p>
                <p className="text-sm text-muted-foreground">Total Hours</p>
              </div>
              <div className="text-center">
                <p
                  className={cn(
                    "text-2xl font-display font-bold",
                    targetMet >= 100 ? "text-success" : targetMet >= 80 ? "text-warning" : "text-destructive",
                  )}
                >
                  {targetMet}%
                </p>
                <p className="text-sm text-muted-foreground">Performance Metrics</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-display font-bold">{Math.max(0, targetHours - weeklyTotal).toFixed(1)}h</p>
                <p className="text-sm text-muted-foreground">Remaining</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Weekly Logs Table */}
      <Card className="animate-slide-up opacity-0" style={{ animationDelay: "300ms", animationFillMode: "forwards" }}>
        <CardHeader>
          <CardTitle className="font-display text-lg">This Week's Logs</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table className="min-w-[600px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Date</TableHead>
                <TableHead>Clock In</TableHead>
                <TableHead>Clock Out</TableHead>
                <TableHead>Break</TableHead>
                <TableHead>Pause</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Hours Worked</TableHead>
                <TableHead className="text-right">Adjustment</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {weeklyLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No attendance logs for this week
                  </TableCell>
                </TableRow>
              ) : (
                weeklyLogs.map((log, index) => {
                  const clockOutDate = log.clock_out ? new Date(log.clock_out) : null;
                  const breakMinutes = log.total_break_minutes || 0;
                  const pauseMinutes = (log as any).total_pause_minutes || 0;

                  let hours = "-";
                  if (clockOutDate) {
                    const clockInDate = new Date(log.clock_in);
                    const diffMs = clockOutDate.getTime() - clockInDate.getTime();
                    const netWorkMs = diffMs - (breakMinutes + pauseMinutes) * 60 * 1000;
                    hours = `${(Math.max(0, netWorkMs) / (1000 * 60 * 60)).toFixed(2)}h`;
                  }

                  const inFmt = formatAttendanceTime(log.clock_in, tz);
                  const outFmt = log.clock_out ? formatAttendanceTime(log.clock_out, tz) : null;
                  const nightShift = log.clock_out ? isNightShift(log.clock_in, log.clock_out, tz) : false;

                  return (
                    <TableRow
                      key={log.id}
                      className="animate-fade-in"
                      style={{ animationDelay: `${400 + index * 50}ms` }}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-1.5">
                          {getWorkDateDisplay(log.clock_in, tz)}
                          {nightShift && <span title="Night shift">🌙</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs">{inFmt.localTime} {inFmt.tzAbbr}</span>
                      </TableCell>
                      <TableCell>
                        {outFmt ? (
                          <span className="text-xs">{outFmt.localTime} {outFmt.tzAbbr}</span>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        {log.break_start ? (
                          <div className="space-y-1">
                            <span className="text-yellow-600 font-mono text-xs">
                              {format(new Date(log.break_start), "HH:mm")} -{" "}
                              {log.break_end ? format(new Date(log.break_end), "HH:mm") : "-"}
                            </span>
                            {breakMinutes > 0 && (
                              <p className="text-xs text-muted-foreground">{formatDuration(breakMinutes)}</p>
                            )}
                          </div>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        {(log as any).pause_start ? (
                          <div className="space-y-1">
                            <span className="text-cyan-600 font-mono text-xs">
                              {format(new Date((log as any).pause_start), "HH:mm")} -{" "}
                              {(log as any).pause_end ? format(new Date((log as any).pause_end), "HH:mm") : "-"}
                            </span>
                            {pauseMinutes > 0 && (
                              <p className="text-xs text-muted-foreground">{formatDuration(pauseMinutes)}</p>
                            )}
                          </div>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            log.clock_type === "billable" && "border-info text-info bg-info/10",
                            log.clock_type === "payroll" && "border-primary text-primary bg-primary/10",
                          )}
                        >
                          {log.clock_type || "payroll"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{hours}</TableCell>
                      <TableCell className="text-right">
                        {(() => {
                          const adj = getAdjustmentStatus(log.id);
                          if (adj) {
                            const reviewerName = adj.reviewer_profile
                              ? `${adj.reviewer_profile.first_name} ${adj.reviewer_profile.last_name}`
                              : null;
                            return (
                              <div className="flex flex-col items-end gap-1">
                                <Badge
                                  variant={
                                    adj.status === "approved"
                                      ? "default"
                                      : adj.status === "rejected"
                                        ? "destructive"
                                        : "secondary"
                                  }
                                  className="capitalize"
                                >
                                  {adj.status}
                                </Badge>
                                {reviewerName && (
                                  <span className="text-xs text-muted-foreground">by {reviewerName}</span>
                                )}
                                {adj.override_status && (
                                  <Badge variant="outline" className="text-xs border-amber-500 text-amber-600">
                                    Overridden
                                  </Badge>
                                )}
                              </div>
                            );
                          }
                          return (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs gap-1"
                              onClick={() => setAdjustmentLog(log)}
                            >
                              <PenLine className="h-3 w-3" />
                              Adjust
                            </Button>
                          );
                        })()}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Manager: Team Adjustment Requests */}
      {(isManager || isLineManager) && teamRequests.length > 0 && (
        <ManagerAdjustmentPanel
          requests={teamRequests}
          onReview={async (id, decision, comment) => {
            const success = await reviewRequest(id, decision, comment);
            if (success && decision === "approved") {
              // Refetch attendance data so the corrected values show immediately
              refetch();
            }
            return success;
          }}
          canOverride={isAdmin || isVP}
          onOverride={async (id, decision, comment) => {
            const success = await overrideRequest(id, decision, comment);
            if (success) {
              refetch();
            }
            return success;
          }}
        />
      )}

      {/* Adjustment Request Dialog */}
      {adjustmentLog && (
        <AdjustmentRequestDialog
          log={adjustmentLog}
          open={!!adjustmentLog}
          onOpenChange={(open) => {
            if (!open) setAdjustmentLog(null);
          }}
          onSubmit={submitRequest}
        />
      )}
    </DashboardLayout>
  );
};

export default Attendance;
