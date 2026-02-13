import { useState, Fragment } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
  DollarSign,
  Pause,
  Target,
  Timer,
  ChevronDown,
  ChevronUp,
  Home,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAttendance } from "@/hooks/useAttendance";
import { useAuth } from "@/contexts/AuthContext";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval, isToday } from "date-fns";
import { toast } from "@/hooks/use-toast";

const TARGET_WORK_HOURS = 8;
const TARGET_WORK_MINUTES = TARGET_WORK_HOURS * 60;

const Attendance = () => {
  const { user } = useAuth();
  const [clockType, setClockType] = useState<"payroll" | "billable">("payroll");
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const currentDate = new Date();

  const {
    currentLog,
    weeklyLogs,
    loading,
    clockIn,
    clockOut,
    startBreak,
    endBreak,
    startPause,
    endPause,
    monthlyHours,
  } = useAttendance(currentWeekStart);

  const getClockStatus = () => {
    if (!currentLog) return "out";
    if (currentLog.clock_out) return "out";
    if ((currentLog as any).pause_start && !(currentLog as any).pause_end) return "paused";
    if (currentLog.break_start && !currentLog.break_end) return "break";
    return "in";
  };

  const clockStatus = getClockStatus();

  // Calculate work time (elapsed - pauses - breaks)
  const getWorkTimeMs = () => {
    if (!currentLog || !currentLog.clock_in) return 0;
    const now = new Date();
    const clockInTime = new Date(currentLog.clock_in).getTime();

    let elapsed = now.getTime() - clockInTime;

    // Subtract pauses (clock stopped time)
    const pauseMinutes = (currentLog as any).total_pause_minutes || 0;
    elapsed -= pauseMinutes * 60 * 1000;

    if (clockStatus === "paused" && (currentLog as any).pause_start) {
      const pauseStart = new Date((currentLog as any).pause_start).getTime();
      elapsed -= now.getTime() - pauseStart;
    }

    // Subtract breaks
    const breakMinutes = currentLog.total_break_minutes || 0;
    elapsed -= breakMinutes * 60 * 1000;

    if (clockStatus === "break" && currentLog.break_start) {
      const breakStart = new Date(currentLog.break_start).getTime();
      elapsed -= now.getTime() - breakStart;
    }

    return Math.max(0, elapsed);
  };

  const getTimeWorked = () => {
    const workMs = getWorkTimeMs();
    const hours = Math.floor(workMs / (1000 * 60 * 60));
    const minutes = Math.floor((workMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const getProgressPercent = () => {
    const workMs = getWorkTimeMs();
    const workMinutes = Math.floor(workMs / 60000);
    return Math.min(100, Math.round((workMinutes / TARGET_WORK_MINUTES) * 100));
  };

  const formatMinutes = (minutes: number): string => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const getCurrentBreakMinutes = () => {
    if (!currentLog) return 0;
    let total = currentLog.total_break_minutes || 0;
    if (clockStatus === "break" && currentLog.break_start) {
      const breakStart = new Date(currentLog.break_start);
      total += Math.floor((new Date().getTime() - breakStart.getTime()) / 60000);
    }
    return total;
  };

  const getCurrentPauseMinutes = () => {
    if (!currentLog) return 0;
    let total = (currentLog as any).total_pause_minutes || 0;
    if (clockStatus === "paused" && (currentLog as any).pause_start) {
      const pauseStart = new Date((currentLog as any).pause_start);
      total += Math.floor((new Date().getTime() - pauseStart.getTime()) / 60000);
    }
    return total;
  };

  const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: currentWeekStart, end: weekEnd });

  // Calculate hours per day (work time = elapsed - pauses - breaks)
  const getHoursForDay = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    const dayLogs = weeklyLogs.filter((log) => {
      const logDate = format(new Date(log.clock_in), "yyyy-MM-dd");
      return logDate === dateStr;
    });

    let totalMinutes = 0;
    dayLogs.forEach((log) => {
      if (log.clock_in) {
        const start = new Date(log.clock_in);
        const end = log.clock_out ? new Date(log.clock_out) : new Date();
        const pauseMinutes = (log as any).total_pause_minutes || 0;
        const breakMinutes = log.total_break_minutes || 0;
        const elapsedMs = end.getTime() - start.getTime();
        const activeMs = elapsedMs - pauseMinutes * 60 * 1000;
        const workMs = activeMs - breakMinutes * 60 * 1000;
        totalMinutes += Math.max(0, workMs / (1000 * 60));
      }
    });

    return Math.round((totalMinutes / 60) * 10) / 10;
  };

  const handleClockIn = async () => await clockIn(clockType);
  const handleClockOut = async () => await clockOut();
  const handleBreak = async () => (clockStatus === "break" ? await endBreak() : await startBreak());
  const handlePause = async () => (clockStatus === "paused" ? await endPause() : await startPause());

  const handleExport = () => {
    const headers = [
      "Date",
      "Clock In",
      "Breaks",
      "Break Time (min)",
      "Paused Time (min)",
      "Clock Out",
      "Work Hours",
      "Status",
    ];

    const rows = weeklyLogs.map((log) => {
      const clockIn = new Date(log.clock_in);
      const clockOut = log.clock_out ? new Date(log.clock_out) : null;
      const breakMinutes = log.total_break_minutes || 0;
      const pauseMinutes = (log as any).total_pause_minutes || 0;

      let hours = "-";
      let status = "In Progress";
      if (clockOut) {
        const elapsedMs = clockOut.getTime() - clockIn.getTime();
        const activeMs = elapsedMs - pauseMinutes * 60 * 1000;
        const workMs = activeMs - breakMinutes * 60 * 1000;
        const workHours = Math.max(0, workMs) / (1000 * 60 * 60);
        hours = workHours.toFixed(2);

        if (workHours >= 8.5) status = "Overtime";
        else if (workHours >= 7.5) status = "Complete";
        else status = "Short Time";
      }

      return [
        format(clockIn, "yyyy-MM-dd"),
        format(clockIn, "hh:mm a"),
        breakMinutes > 0 ? "Yes" : "No",
        breakMinutes,
        pauseMinutes,
        clockOut ? format(clockOut, "hh:mm a") : "-",
        hours,
        status,
      ].join(",");
    });

    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `my-attendance-${format(currentWeekStart, "yyyy-MM-dd")}.csv`;
    a.click();

    toast({ title: "Export Complete", description: "Your attendance report has been downloaded." });
  };

  const weeklyTotal = weekDays.reduce((acc, day) => acc + getHoursForDay(day), 0);
  const targetHours = 40;
  const targetMet = Math.round((weeklyTotal / targetHours) * 100);

  const formatTime12 = (dateString: string | null) => {
    if (!dateString) return "-";
    return format(new Date(dateString), "hh:mm a");
  };

  const getWorkStatus = (log: any) => {
    if (!log.clock_out) return { label: "In Progress", variant: "secondary" as const };

    const clockIn = new Date(log.clock_in);
    const clockOut = new Date(log.clock_out);
    const pauseMinutes = log.total_pause_minutes || 0;
    const breakMinutes = log.total_break_minutes || 0;
    const elapsedMs = clockOut.getTime() - clockIn.getTime();
    const activeMs = elapsedMs - pauseMinutes * 60 * 1000;
    const workMs = activeMs - breakMinutes * 60 * 1000;
    const totalHours = Math.max(0, workMs) / (1000 * 60 * 60);

    if (totalHours >= 8.5) return { label: "Overtime", variant: "default" as const };
    if (totalHours >= 7.5) return { label: "Complete", variant: "default" as const };
    return { label: "Short Time", variant: "destructive" as const };
  };

  const calculateTotalHours = (log: any) => {
    if (!log.clock_out) return null;

    const clockIn = new Date(log.clock_in);
    const clockOut = new Date(log.clock_out);
    const pauseMinutes = log.total_pause_minutes || 0;
    const breakMinutes = log.total_break_minutes || 0;
    const elapsedMs = clockOut.getTime() - clockIn.getTime();
    const activeMs = elapsedMs - pauseMinutes * 60 * 1000;
    const workMs = activeMs - breakMinutes * 60 * 1000;
    return Math.max(0, workMs / (1000 * 60 * 60));
  };

  const toggleRowExpanded = (rowKey: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowKey)) next.delete(rowKey);
      else next.add(rowKey);
      return next;
    });
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  const progressPercent = getProgressPercent();
  const currentBreakMinutes = getCurrentBreakMinutes();
  const currentPauseMinutes = getCurrentPauseMinutes();

  return (
    <DashboardLayout>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 animate-fade-in">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">My Attendance</h1>
          <p className="text-muted-foreground mt-1">Track your time and view detailed records</p>
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
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="text-center py-6 rounded-xl bg-secondary/50 border border-border">
              <p className="text-5xl font-display font-bold tracking-wider">
                {currentDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
              </p>
              <p className="text-muted-foreground mt-2">
                {currentDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
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
                <p className="text-xs text-muted-foreground text-center">
                  {progressPercent >= 100
                    ? "Target achieved! 🎉"
                    : `${formatMinutes(TARGET_WORK_MINUTES - Math.floor(getWorkTimeMs() / 60000))} remaining`}
                </p>
              </div>
            )}

            {/* Break & Pause Display */}
            {clockStatus !== "out" &&
              (currentBreakMinutes > 0 ||
                currentPauseMinutes > 0 ||
                clockStatus === "break" ||
                clockStatus === "paused") && (
                <div className="grid grid-cols-2 gap-2">
                  <div
                    className={cn(
                      "p-3 rounded-lg border text-center",
                      clockStatus === "break" ? "bg-warning/10 border-warning/30" : "bg-accent/50",
                    )}
                  >
                    <Coffee
                      className={cn(
                        "h-4 w-4 mx-auto mb-1",
                        clockStatus === "break" ? "text-warning" : "text-muted-foreground",
                      )}
                    />
                    <p className={cn("text-lg font-bold", clockStatus === "break" ? "text-warning" : "")}>
                      {formatMinutes(currentBreakMinutes)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Break (deducted)</p>
                  </div>
                  <div
                    className={cn(
                      "p-3 rounded-lg border text-center",
                      clockStatus === "paused" ? "bg-info/10 border-info/30" : "bg-accent/50",
                    )}
                  >
                    <Pause
                      className={cn(
                        "h-4 w-4 mx-auto mb-1",
                        clockStatus === "paused" ? "text-info" : "text-muted-foreground",
                      )}
                    />
                    <p className={cn("text-lg font-bold", clockStatus === "paused" ? "text-info" : "")}>
                      {formatMinutes(currentPauseMinutes)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Paused (stopped)</p>
                  </div>
                </div>
              )}

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

            {/* Help text */}
            {clockStatus !== "out" && (
              <div className="text-[10px] text-muted-foreground text-center space-y-1 pt-2 border-t">
                <p>
                  <Coffee className="h-3 w-3 inline mr-1" />
                  <strong>Break:</strong> Lunch/rest - deducted from work time
                </p>
                <p>
                  <Pause className="h-3 w-3 inline mr-1" />
                  <strong>Pause:</strong> Stop clock (office↔home) - resume anytime
                </p>
              </div>
            )}
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
                  onClick={() => setCurrentWeekStart(subWeeks(currentWeekStart, 1))}
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
                  onClick={() => setCurrentWeekStart(addWeeks(currentWeekStart, 1))}
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
                          style={{ height: `${Math.min((hours / 10) * 100, 100)}%` }}
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
                <p className="text-sm text-muted-foreground">Work Hours</p>
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
                <p className="text-sm text-muted-foreground">Target Met</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-display font-bold">{Math.max(0, targetHours - weeklyTotal).toFixed(1)}h</p>
                <p className="text-sm text-muted-foreground">Remaining</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Weekly Logs Table */}
      <Card className="animate-slide-up opacity-0" style={{ animationDelay: "300ms", animationFillMode: "forwards" }}>
        <CardHeader>
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <Timer className="h-5 w-5 text-primary" />
            Detailed Attendance Logs
          </CardTitle>
          <CardDescription>Your records with breaks, pauses, and work hours</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table className="min-w-[800px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-8"></TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Clock In</TableHead>
                <TableHead>Break Time</TableHead>
                <TableHead>Paused Time</TableHead>
                <TableHead>Clock Out</TableHead>
                <TableHead>Work Hours</TableHead>
                <TableHead>Status</TableHead>
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
                  const clockInDate = new Date(log.clock_in);
                  const breakMinutes = log.total_break_minutes || 0;
                  const pauseMinutes = (log as any).total_pause_minutes || 0;
                  const totalHours = calculateTotalHours(log);
                  const status = getWorkStatus(log);
                  const rowKey = `${log.id}-${index}`;
                  const isExpanded = expandedRows.has(rowKey);

                  const hasBreakDetails = breakMinutes > 0 && log.break_start;
                  const hasPauseDetails = pauseMinutes > 0 && (log as any).pause_start;
                  const hasExpandableContent = hasBreakDetails || hasPauseDetails;

                  return (
                    <Fragment key={log.id}>
                      <TableRow
                        className="animate-fade-in hover:bg-accent/50"
                        style={{ animationDelay: `${400 + index * 50}ms` }}
                      >
                        <TableCell>
                          {hasExpandableContent && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => toggleRowExpanded(rowKey)}
                            >
                              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </Button>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{format(clockInDate, "EEE, MMM d")}</TableCell>
                        <TableCell className="text-success font-mono">{formatTime12(log.clock_in)}</TableCell>
                        <TableCell>
                          {breakMinutes > 0 ? (
                            <div className="flex items-center gap-2">
                              <Coffee className="h-4 w-4 text-warning" />
                              <span className="font-medium text-warning">{formatMinutes(breakMinutes)}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {pauseMinutes > 0 ? (
                            <div className="flex items-center gap-2">
                              <Pause className="h-4 w-4 text-info" />
                              <span className="font-medium text-info">{formatMinutes(pauseMinutes)}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-destructive font-mono">{formatTime12(log.clock_out)}</TableCell>
                        <TableCell className="font-bold">
                          {totalHours !== null ? `${totalHours.toFixed(2)}h` : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </TableCell>
                      </TableRow>

                      {hasExpandableContent && isExpanded && (
                        <TableRow className="bg-accent/30">
                          <TableCell colSpan={8} className="p-0">
                            <div className="px-12 py-3 space-y-2">
                              {hasBreakDetails && (
                                <div className="flex items-center gap-4 text-sm">
                                  <Coffee className="h-4 w-4 text-warning" />
                                  <span className="font-medium">Break:</span>
                                  <span className="text-warning font-mono">
                                    {formatTime12(log.break_start)} - {formatTime12(log.break_end)}
                                  </span>
                                  <span className="text-muted-foreground">
                                    ({breakMinutes}m deducted from work time)
                                  </span>
                                </div>
                              )}
                              {hasPauseDetails && (
                                <div className="flex items-center gap-4 text-sm">
                                  <Home className="h-4 w-4 text-info" />
                                  <span className="font-medium">Paused:</span>
                                  <span className="text-info font-mono">
                                    {formatTime12((log as any).pause_start)} - {formatTime12((log as any).pause_end)}
                                  </span>
                                  <span className="text-muted-foreground">({pauseMinutes}m clock stopped)</span>
                                </div>
                              )}
                            </div>
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
    </DashboardLayout>
  );
};

export default Attendance;
