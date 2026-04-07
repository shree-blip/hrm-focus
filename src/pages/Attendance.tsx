import { useState, useEffect, useMemo, Fragment } from "react";
import { supabase } from "@/integrations/supabase/client";
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
import { useBreakSessions } from "@/hooks/useBreakSessions";
import { BreakPauseCell, BreakPauseDetailPanel } from "@/components/attendance/BreakPauseDetail";
import { cn } from "@/lib/utils";
import { useTimeTracker } from "@/contexts/TimeTrackerContext";
import { useAttendanceAdjustments } from "@/hooks/useAttendanceAdjustments";
import { useLeaveRequests } from "@/hooks/useLeaveRequests";
import { AdjustmentRequestDialog } from "@/components/attendance/AdjustmentRequestDialog";
import { ManagerAdjustmentPanel } from "@/components/attendance/ManagerAdjustmentPanel";
import { useAuth } from "@/contexts/AuthContext";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval, isToday } from "date-fns";
import { toast } from "@/hooks/use-toast";
import { AlertTriangle, X } from "lucide-react";
import {
  formatAttendanceTime,
  getWorkDate,
  getWorkDateDisplay,
  isNightShift,
  DEFAULT_TIMEZONE,
} from "@/utils/timezoneUtils";
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

const STANDARD_HOURS_PER_DAY = 8;

const parseDateOnly = (dateStr: string) => {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
};

const Attendance = () => {
  const { user, isManager, isLineManager, isAdmin, isVP } = useAuth();
  const [clockType, setClockType] = useState<"payroll" | "billable">("payroll");
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    // Temporary default using Asia/Kathmandu — will be corrected by useEffect below
    const tz = "Asia/Kathmandu";
    const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: tz });
    const [y, m, d] = todayStr.split("-").map(Number);
    const todayLocal = new Date(y, m - 1, d);
    const dow = todayLocal.getDay();
    const diff = dow === 0 ? -6 : 1 - dow;
    return new Date(y, m - 1, d + diff);
  });
  const currentDate = new Date();
  const [showClockOutDialog, setShowClockOutDialog] = useState(false);
  const [elapsedTime, setElapsedTime] = useState("00:00:00");
  const [expandedBreakRows, setExpandedBreakRows] = useState<Set<string>>(new Set());
  const { fetchSessions, getSessions, isLoading: isSessionLoading } = useBreakSessions();
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

  useEffect(() => {
    const tz = employeeTimezone || "Asia/Kathmandu";
    const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: tz });
    const [y, m, d] = todayStr.split("-").map(Number);
    const todayLocal = new Date(y, m - 1, d);
    const dow = todayLocal.getDay();
    const diff = dow === 0 ? -6 : 1 - dow;
    const mondayDate = new Date(y, m - 1, d + diff);

    setCurrentWeekStart((prev) => (mondayDate.getTime() !== prev.getTime() ? mondayDate : prev));
  }, [employeeTimezone]);

  // Week-specific logs for navigation (defaults to shared context's current week)
  const [navigatedWeeklyLogs, setNavigatedWeeklyLogs] = useState<any[] | null>(null);
  const isCurrentWeek = (() => {
    const tz = employeeTimezone || "Asia/Kathmandu";
    const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: tz });
    const [y, m, d] = todayStr.split("-").map(Number);
    const todayLocal = new Date(y, m - 1, d);
    const dow = todayLocal.getDay();
    const diff = dow === 0 ? -6 : 1 - dow;
    const thisMonday = new Date(y, m - 1, d + diff);
    return thisMonday.getTime() === currentWeekStart.getTime();
  })();
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
  const { ownRequests: leaveRequests } = useLeaveRequests();

  // Use shared status from context
  const clockStatus = sharedStatus;

  const approvedLeaveHoursByDate = useMemo(() => {
    const leaveHoursMap = new Map<string, number>();

    leaveRequests.forEach((request) => {
      if (request.status !== "approved" || !request.start_date || !request.end_date || request.user_id !== user?.id) {
        return;
      }

      const leaveHoursPerDay = request.is_half_day ? STANDARD_HOURS_PER_DAY / 2 : STANDARD_HOURS_PER_DAY;
      const start = parseDateOnly(request.start_date);
      const end = parseDateOnly(request.end_date);

      for (let current = new Date(start); current <= end; current.setDate(current.getDate() + 1)) {
        const dayOfWeek = current.getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) continue;

        const key = format(current, "yyyy-MM-dd");
        const existingHours = leaveHoursMap.get(key) || 0;
        leaveHoursMap.set(key, Math.min(STANDARD_HOURS_PER_DAY, existingHours + leaveHoursPerDay));
      }
    });

    return leaveHoursMap;
  }, [leaveRequests]);

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

  const getWorkedHoursForDay = (date: Date) => {
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

  const getLeaveHoursForDay = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return approvedLeaveHoursByDate.get(dateStr) || 0;
  };

  const getHoursForDay = (date: Date) => {
    return getWorkedHoursForDay(date);
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
  const handleExport = async () => {
    const formatDateLocal = (ts: string | null) => {
      if (!ts) return "-";
      return getWorkDateDisplay(ts, tz);
    };
    const formatTimeLocal = (ts: string | null) => {
      if (!ts) return "-";
      const f = formatAttendanceTime(ts, tz);
      return f.localTime;
    };

    // Fetch all break/pause sessions for the weekly logs
    const logIds = weeklyLogs.map((l: any) => l.id).filter(Boolean);
    const sessionsMap = new Map<string, any[]>();
    if (logIds.length > 0) {
      const { data: sessions } = await supabase
        .from("attendance_break_sessions")
        .select("id, attendance_log_id, session_type, start_time, end_time, duration_minutes")
        .in("attendance_log_id", logIds)
        .order("start_time", { ascending: true });
      if (sessions) {
        sessions.forEach((s: any) => {
          const arr = sessionsMap.get(s.attendance_log_id) || [];
          arr.push(s);
          sessionsMap.set(s.attendance_log_id, arr);
        });
      }
    }

    // Determine max break/pause counts for dynamic columns
    const maxBreaks = Math.max(1, weeklyLogs.reduce((max: number, log: any) => {
      const s = sessionsMap.get(log.id) || [];
      return Math.max(max, s.filter((x: any) => x.session_type === "break").length);
    }, 0));
    const maxPauses = Math.max(1, weeklyLogs.reduce((max: number, log: any) => {
      const s = sessionsMap.get(log.id) || [];
      return Math.max(max, s.filter((x: any) => x.session_type === "pause").length);
    }, 0));

    // Build dynamic header matching Reports page format
    let header = "Date,Clock In";
    for (let i = 1; i <= maxBreaks; i++) {
      header += `,Break ${i} Start,Break ${i} End,Break ${i} Duration (min)`;
    }
    header += ",Total Breaks Count,Total Break Time (min)";
    for (let i = 1; i <= maxPauses; i++) {
      header += `,Pause ${i} Start,Pause ${i} End,Pause ${i} Duration (min)`;
    }
    header += ",Total Pauses Count,Total Pause Time (min)";
    header += ",Clock Out,Total Hours (excl. breaks & pauses),Status\n";

    let csvContent = header;

    weeklyLogs.forEach((log: any) => {
      const clockInTime = new Date(log.clock_in);
      const clockOutTime = log.clock_out ? new Date(log.clock_out) : null;
      const allSessions = sessionsMap.get(log.id) || [];
      const breaks = allSessions.filter((s: any) => s.session_type === "break");
      const pauses = allSessions.filter((s: any) => s.session_type === "pause");

      const totalBreakMinutes = log.total_break_minutes || breaks.reduce((sum: number, b: any) => sum + (b.duration_minutes || 0), 0);
      const totalPauseMinutes = log.total_pause_minutes || pauses.reduce((sum: number, p: any) => sum + (p.duration_minutes || 0), 0);

      let totalHoursStr = "In Progress";
      if (clockOutTime) {
        const diffMs = clockOutTime.getTime() - clockInTime.getTime();
        const netMs = diffMs - (totalBreakMinutes + totalPauseMinutes) * 60 * 1000;
        totalHoursStr = (Math.max(0, netMs) / (1000 * 60 * 60)).toFixed(2);
      }

      const status = clockOutTime ? (parseFloat(totalHoursStr) >= 8 ? "Full Day" : "Short Day") : "In Progress";

      let row = `"${formatDateLocal(log.clock_in)}","${formatTimeLocal(log.clock_in)}"`;

      // Break details
      for (let i = 0; i < maxBreaks; i++) {
        if (breaks[i]) {
          const brk = breaks[i];
          let dur = brk.duration_minutes || 0;
          if (!dur && brk.start_time && brk.end_time) {
            dur = Math.round((new Date(brk.end_time).getTime() - new Date(brk.start_time).getTime()) / (1000 * 60));
          }
          row += `,"${formatTimeLocal(brk.start_time)}","${formatTimeLocal(brk.end_time)}",${dur}`;
        } else {
          row += `,"-","-",0`;
        }
      }
      row += `,${breaks.length},${totalBreakMinutes}`;

      // Pause details
      for (let i = 0; i < maxPauses; i++) {
        if (pauses[i]) {
          const p = pauses[i];
          let dur = p.duration_minutes || 0;
          if (!dur && p.start_time && p.end_time) {
            dur = Math.round((new Date(p.end_time).getTime() - new Date(p.start_time).getTime()) / (1000 * 60));
          }
          row += `,"${formatTimeLocal(p.start_time)}","${formatTimeLocal(p.end_time)}",${dur}`;
        } else {
          row += `,"-","-",0`;
        }
      }
      row += `,${pauses.length},${totalPauseMinutes}`;

      row += `,"${formatTimeLocal(log.clock_out)}",${totalHoursStr},"${status}"\n`;
      csvContent += row;
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `attendance-${format(currentWeekStart, "yyyy-MM-dd")}.csv`;
    link.click();

    toast({
      title: "Export Complete",
      description: "Attendance report downloaded with detailed break & pause sessions.",
    });
  };

  // Weekly totals use actual worked hours, while approved leave reduces the target for the week.
  const weeklyTotal = weekDays.reduce((acc, day) => acc + getHoursForDay(day), 0);
  const baseTargetHours =
    weekDays.filter((day) => day.getDay() !== 0 && day.getDay() !== 6).length * STANDARD_HOURS_PER_DAY;
  const weeklyLeaveHours = weekDays.reduce((acc, day) => {
    if (day.getDay() === 0 || day.getDay() === 6) return acc;
    return acc + Math.min(STANDARD_HOURS_PER_DAY, getLeaveHoursForDay(day));
  }, 0);
  const adjustedTargetHours = Math.max(0, baseTargetHours - weeklyLeaveHours);
  const leaveDaysTaken = weeklyLeaveHours / STANDARD_HOURS_PER_DAY;
  const targetMet = adjustedTargetHours === 0 ? 100 : Math.round((weeklyTotal / adjustedTargetHours) * 100);

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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-6 sm:mb-8 animate-fade-in">
        <div className="min-w-0">
          <h1 className="heading-page font-display font-bold text-foreground">Attendance</h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">Track time and manage attendance records</p>
        </div>
        <Button variant="outline" className="gap-2 shrink-0 w-full sm:w-auto" onClick={handleExport}>
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

            <div className="text-center py-6 sm:py-8 rounded-xl bg-secondary/50 border border-border">
              <p className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold tracking-wider text-foreground">{elapsedTime}</p>

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
                const leaveHours = getLeaveHoursForDay(day);
                const isLeaveDay = leaveHours > 0;
                const isHalfLeave = leaveHours > 0 && leaveHours < STANDARD_HOURS_PER_DAY;
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
                        "relative h-16 sm:h-24 rounded-lg bg-secondary/50 flex items-end justify-center pb-1 sm:pb-2 overflow-hidden border",
                        !isWeekend &&
                          hours === 0 &&
                          !isToday(day) &&
                          !isLeaveDay &&
                          "border-dashed border-destructive/30",
                        isLeaveDay && "border-emerald-200 bg-emerald-50/80",
                        isToday(day) && "ring-2 ring-primary",
                      )}
                    >
                      {isLeaveDay && (
                        <span className="absolute top-1 right-1 z-10 rounded-full bg-emerald-600 px-1.5 py-0.5 text-[10px] font-medium text-white">
                          {isHalfLeave ? "Half Leave" : "Leave"}
                        </span>
                      )}

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
                          hours > 0
                            ? "text-primary-foreground"
                            : isLeaveDay
                              ? "text-emerald-700"
                              : "text-muted-foreground",
                        )}
                      >
                        {hours > 0 ? `${hours}h` : isLeaveDay ? (isHalfLeave ? "½ Leave" : "Leave") : "-"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
              <div className="text-center">
                <p className="text-2xl font-display font-bold">{weeklyTotal.toFixed(1)}h</p>
                <p className="text-sm text-muted-foreground">Worked Hours</p>
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
                <p className="text-2xl font-display font-bold">
                  {Math.max(0, adjustedTargetHours - weeklyTotal).toFixed(1)}h
                </p>
                <p className="text-sm text-muted-foreground">Remaining</p>
              </div>
            </div>
            {weeklyLeaveHours > 0 && (
              <p className="mt-3 text-xs text-muted-foreground">
                Approved leave this week:{" "}
                {leaveDaysTaken % 1 === 0 ? leaveDaysTaken.toFixed(0) : leaveDaysTaken.toFixed(1)} day
                {leaveDaysTaken === 1 ? "" : "s"} • target adjusted from {baseTargetHours}h to {adjustedTargetHours}h.
              </p>
            )}
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
                  const rowKey = `break-${log.id}`;
                  const isBreakExpanded = expandedBreakRows.has(rowKey);
                  const hasBreakOrPause = breakMinutes > 0 || pauseMinutes > 0;

                  const handleToggleBreakDetail = async () => {
                    if (isBreakExpanded) {
                      setExpandedBreakRows((prev) => {
                        const next = new Set(prev);
                        next.delete(rowKey);
                        return next;
                      });
                    } else {
                      await fetchSessions(log.id);
                      setExpandedBreakRows((prev) => new Set(prev).add(rowKey));
                    }
                  };

                  return (
                    <Fragment key={log.id}>
                      <TableRow
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
                          <span className="text-xs">
                            {inFmt.localTime} {inFmt.tzAbbr}
                          </span>
                        </TableCell>
                        <TableCell>
                          {outFmt ? (
                            <span className="text-xs">
                              {outFmt.localTime} {outFmt.tzAbbr}
                            </span>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell>
                          <BreakPauseCell
                            totalMinutes={breakMinutes}
                            type="break"
                            isExpanded={isBreakExpanded}
                            onToggle={handleToggleBreakDetail}
                            hasLegacyTime={!!log.break_start}
                            timezone={tz}
                          />
                        </TableCell>
                        <TableCell>
                          <BreakPauseCell
                            totalMinutes={pauseMinutes}
                            type="pause"
                            isExpanded={isBreakExpanded}
                            onToggle={handleToggleBreakDetail}
                            hasLegacyTime={!!(log as any).pause_start}
                            timezone={tz}
                          />
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
                      {/* Expanded break/pause session detail */}
                      {isBreakExpanded && (
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                          <TableCell colSpan={8} className="px-8 py-3">
                            <BreakPauseDetailPanel
                              sessions={getSessions(log.id)}
                              loading={isSessionLoading(log.id)}
                              timezone={tz}
                              legacyData={{
                                break_start: log.break_start,
                                break_end: log.break_end,
                                total_break_minutes: log.total_break_minutes,
                                pause_start: log.pause_start,
                                pause_end: log.pause_end,
                                total_pause_minutes: log.total_pause_minutes,
                              }}
                            />
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
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
