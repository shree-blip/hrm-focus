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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAttendance } from "@/hooks/useAttendance";
import { useAuth } from "@/contexts/AuthContext";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval, isToday } from "date-fns";
import { toast } from "@/hooks/use-toast";

const Attendance = () => {
  const { user, isManager } = useAuth();
  const [clockType, setClockType] = useState<"payroll" | "billable">("payroll");
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const currentDate = new Date();

  const {
    currentLog,
    weeklyLogs,
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
  } = useAttendance(currentWeekStart);

  // Calculate clock status
  const getClockStatus = () => {
    if (!currentLog) return "out";
    if (currentLog.clock_out) return "out";
    if ((currentLog as any).pause_start && !(currentLog as any).pause_end) return "paused";
    if (currentLog.break_start && !currentLog.break_end) return "break";
    return "in";
  };

  const clockStatus = getClockStatus();

  // Calculate time worked today (excluding breaks and pauses)
  const getTimeWorked = () => {
    if (!currentLog || !currentLog.clock_in) return "0h 0m";
    const start = new Date(currentLog.clock_in);
    const end = currentLog.clock_out ? new Date(currentLog.clock_out) : new Date();
    const breakMinutes = currentLog.total_break_minutes || 0;
    const pauseMinutes = (currentLog as any).total_pause_minutes || 0;
    const diffMs = end.getTime() - start.getTime() - breakMinutes * 60 * 1000 - pauseMinutes * 60 * 1000;
    const hours = Math.floor(Math.max(0, diffMs) / (1000 * 60 * 60));
    const minutes = Math.floor((Math.max(0, diffMs) % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  // Generate week days
  const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: currentWeekStart, end: weekEnd });

  // Calculate hours per day from weekly logs (excluding breaks and pauses)
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
        const breakMinutes = log.total_break_minutes || 0;
        const pauseMinutes = (log as any).total_pause_minutes || 0;
        const diffMs = end.getTime() - start.getTime() - breakMinutes * 60 * 1000 - pauseMinutes * 60 * 1000;
        totalMinutes += Math.max(0, diffMs / (1000 * 60));
      }
    });

    return Math.round((totalMinutes / 60) * 10) / 10; // Round to 1 decimal
  };

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

  const handleExport = () => {
    // Generate CSV with pause data
    const headers = ["Date", "Clock In", "Clock Out", "Break (min)", "Pause (min)", "Total Hours", "Type"];
    const rows = weeklyLogs.map((log) => {
      const clockIn = new Date(log.clock_in);
      const clockOut = log.clock_out ? new Date(log.clock_out) : null;
      const breakMinutes = log.total_break_minutes || 0;
      const pauseMinutes = (log as any).total_pause_minutes || 0;
      let hours = "-";
      if (clockOut) {
        const diffMs = clockOut.getTime() - clockIn.getTime() - breakMinutes * 60 * 1000 - pauseMinutes * 60 * 1000;
        hours = (Math.max(0, diffMs) / (1000 * 60 * 60)).toFixed(2);
      }
      return [
        format(clockIn, "yyyy-MM-dd"),
        format(clockIn, "hh:mm a"),
        clockOut ? format(clockOut, "hh:mm a") : "-",
        breakMinutes,
        pauseMinutes,
        hours,
        log.clock_type || "payroll",
      ].join(",");
    });

    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance-${format(currentWeekStart, "yyyy-MM-dd")}.csv`;
    a.click();

    toast({ title: "Export Complete", description: "Attendance report downloaded." });
  };

  // Calculate weekly totals
  const weeklyTotal = weekDays.reduce((acc, day) => acc + getHoursForDay(day), 0);
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
              <p className="text-5xl font-display font-bold tracking-wider">
                {currentDate.toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
              <p className="text-muted-foreground mt-2">
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
            </div>

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
              </TableRow>
            </TableHeader>
            <TableBody>
              {weeklyLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No attendance logs for this week
                  </TableCell>
                </TableRow>
              ) : (
                weeklyLogs.map((log, index) => {
                  const clockInDate = new Date(log.clock_in);
                  const clockOutDate = log.clock_out ? new Date(log.clock_out) : null;
                  const breakMinutes = log.total_break_minutes || 0;
                  const pauseMinutes = (log as any).total_pause_minutes || 0;

                  let hours = "-";
                  if (clockOutDate) {
                    const diffMs =
                      clockOutDate.getTime() -
                      clockInDate.getTime() -
                      breakMinutes * 60 * 1000 -
                      pauseMinutes * 60 * 1000;
                    hours = `${(Math.max(0, diffMs) / (1000 * 60 * 60)).toFixed(2)}h`;
                  }

                  return (
                    <TableRow
                      key={log.id}
                      className="animate-fade-in"
                      style={{ animationDelay: `${400 + index * 50}ms` }}
                    >
                      <TableCell className="font-medium">{format(clockInDate, "EEE, MMM d")}</TableCell>
                      <TableCell>{format(clockInDate, "hh:mm a")}</TableCell>
                      <TableCell>{clockOutDate ? format(clockOutDate, "hh:mm a") : "-"}</TableCell>
                      <TableCell>{breakMinutes > 0 ? `${breakMinutes}m` : "-"}</TableCell>
                      <TableCell>{pauseMinutes > 0 ? `${pauseMinutes}m` : "-"}</TableCell>
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
                    </TableRow>
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
