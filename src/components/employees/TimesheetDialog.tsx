import { useEffect, useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, Clock, Coffee, Pause, TrendingUp, Loader2, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Employee {
  id: number | string;
  name: string;
  email: string;
  role: string;
  department: string;
  location: string;
  status: string;
  initials: string;
  phone: string;
  user_id?: string;
}

interface TimesheetDialogProps {
  employee: Employee | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

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

export function TimesheetDialog({ employee, open, onOpenChange }: TimesheetDialogProps) {
  const [loading, setLoading] = useState(true);
  const [weeklyLogs, setWeeklyLogs] = useState<AttendanceLog[]>([]);
  const [monthlyLogs, setMonthlyLogs] = useState<AttendanceLog[]>([]);
  const [weekOffset, setWeekOffset] = useState(0); // 0 = current week, -1 = last week, etc.
  const [activeTab, setActiveTab] = useState<"week" | "month">("week");

  // Fetch attendance data when dialog opens or employee changes
  useEffect(() => {
    if (!open || !employee) return;

    const fetchAttendanceData = async () => {
      setLoading(true);

      // Get user_id from employee - it might be stored as user_id or we need to look it up
      let userId = employee.user_id;

      // If user_id not provided, try to get it from employees table
      if (!userId) {
        const { data: empData } = await supabase
          .from("employees")
          .select("profile_id")
          .eq("id", String(employee.id))
          .single();

        if (empData?.profile_id) {
          const { data: profileData } = await supabase
            .from("profiles")
            .select("user_id")
            .eq("id", empData.profile_id)
            .single();

          userId = profileData?.user_id;
        }
      }

      if (!userId) {
        setLoading(false);
        return;
      }

      // Calculate week range based on offset
      const today = new Date();
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay() + 1 + weekOffset * 7); // Monday
      weekStart.setHours(0, 0, 0, 0);

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6); // Sunday
      weekEnd.setHours(23, 59, 59, 999);

      // Fetch weekly logs
      const { data: weekData } = await supabase
        .from("attendance_logs")
        .select("*")
        .eq("user_id", userId)
        .gte("clock_in", weekStart.toISOString())
        .lte("clock_in", weekEnd.toISOString())
        .order("clock_in", { ascending: true });

      // Calculate month range
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      monthStart.setHours(0, 0, 0, 0);
      const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      monthEnd.setHours(23, 59, 59, 999);

      // Fetch monthly logs
      const { data: monthData } = await supabase
        .from("attendance_logs")
        .select("*")
        .eq("user_id", userId)
        .gte("clock_in", monthStart.toISOString())
        .lte("clock_in", monthEnd.toISOString())
        .order("clock_in", { ascending: true });

      setWeeklyLogs((weekData as AttendanceLog[]) || []);
      setMonthlyLogs((monthData as AttendanceLog[]) || []);
      setLoading(false);
    };

    fetchAttendanceData();
  }, [open, employee, weekOffset]);

  // Calculate work time for a log entry
  const calculateWorkTime = (log: AttendanceLog): number | null => {
    if (!log.clock_out) return null;

    const clockIn = new Date(log.clock_in).getTime();
    const clockOut = new Date(log.clock_out).getTime();
    const totalBreakMs = (log.total_break_minutes || 0) * 60 * 1000;
    const totalPauseMs = (log.total_pause_minutes || 0) * 60 * 1000;

    const workMs = clockOut - clockIn - totalBreakMs - totalPauseMs;
    return Math.max(0, workMs / (1000 * 60 * 60)); // Convert to hours
  };

  // Calculate statistics
  const weeklyStats = useMemo(() => {
    const completedLogs = weeklyLogs.filter((log) => log.clock_out);
    const totalHours = completedLogs.reduce((sum, log) => {
      const hours = calculateWorkTime(log);
      return sum + (hours || 0);
    }, 0);
    const totalBreakMinutes = weeklyLogs.reduce((sum, log) => sum + (log.total_break_minutes || 0), 0);
    const totalPauseMinutes = weeklyLogs.reduce((sum, log) => sum + (log.total_pause_minutes || 0), 0);

    return {
      totalHours: totalHours.toFixed(1),
      daysWorked: completedLogs.length,
      avgHoursPerDay: completedLogs.length > 0 ? (totalHours / completedLogs.length).toFixed(1) : "0",
      totalBreakMinutes,
      totalPauseMinutes,
      inProgressDays: weeklyLogs.length - completedLogs.length,
    };
  }, [weeklyLogs]);

  const monthlyStats = useMemo(() => {
    const completedLogs = monthlyLogs.filter((log) => log.clock_out);
    const totalHours = completedLogs.reduce((sum, log) => {
      const hours = calculateWorkTime(log);
      return sum + (hours || 0);
    }, 0);
    const totalBreakMinutes = monthlyLogs.reduce((sum, log) => sum + (log.total_break_minutes || 0), 0);
    const totalPauseMinutes = monthlyLogs.reduce((sum, log) => sum + (log.total_pause_minutes || 0), 0);

    return {
      totalHours: totalHours.toFixed(1),
      daysWorked: completedLogs.length,
      avgHoursPerDay: completedLogs.length > 0 ? (totalHours / completedLogs.length).toFixed(1) : "0",
      totalBreakMinutes,
      totalPauseMinutes,
      attendanceRate: monthlyLogs.length > 0 ? Math.round((completedLogs.length / monthlyLogs.length) * 100) : 0,
    };
  }, [monthlyLogs]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  };

  const formatTime = (dateString: string | null) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  };

  const formatDuration = (minutes: number): string => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const getWorkStatus = (log: AttendanceLog) => {
    if (!log.clock_out) return { label: "In Progress", variant: "secondary" as const };
    const hours = calculateWorkTime(log);
    if (!hours) return { label: "Unknown", variant: "secondary" as const };
    if (hours >= 8.5) return { label: "Overtime", variant: "default" as const };
    if (hours >= 7.5) return { label: "Complete", variant: "default" as const };
    return { label: "Short Time", variant: "destructive" as const };
  };

  // Get week range display
  const getWeekRangeDisplay = () => {
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay() + 1 + weekOffset * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    return `${weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${weekEnd.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
  };

  const exportToCSV = () => {
    const logs = activeTab === "week" ? weeklyLogs : monthlyLogs;
    const period =
      activeTab === "week"
        ? getWeekRangeDisplay()
        : new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });

    let csvContent = `Timesheet Report - ${employee?.name}\n`;
    csvContent += `Period: ${period}\n`;
    csvContent += `Department: ${employee?.department}\n\n`;
    csvContent += "Date,Clock In,Clock Out,Break Time,Pause Time,Total Hours,Status\n";

    logs.forEach((log) => {
      const workHours = calculateWorkTime(log);
      const status = getWorkStatus(log).label;
      csvContent += `"${formatDate(log.clock_in)}","${formatTime(log.clock_in)}","${formatTime(log.clock_out)}","${formatDuration(log.total_break_minutes || 0)}","${formatDuration(log.total_pause_minutes || 0)}","${workHours ? workHours.toFixed(2) + "h" : "-"}","${status}"\n`;
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `timesheet-${employee?.name.replace(/\s+/g, "-")}-${new Date().toISOString().split("T")[0]}.csv`,
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!employee) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="font-display text-2xl">Timesheet - {employee.name}</DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {employee.department} • {employee.role}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={exportToCSV} className="gap-2">
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-4">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "week" | "month")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="week" className="gap-2">
                  <Calendar className="h-4 w-4" />
                  Weekly View
                </TabsTrigger>
                <TabsTrigger value="month" className="gap-2">
                  <Clock className="h-4 w-4" />
                  Monthly View
                </TabsTrigger>
              </TabsList>

              {/* Weekly View */}
              <TabsContent value="week" className="space-y-4 mt-4">
                {/* Week Navigation */}
                <div className="flex items-center justify-between">
                  <Button variant="outline" size="sm" onClick={() => setWeekOffset(weekOffset - 1)} className="gap-2">
                    <ChevronLeft className="h-4 w-4" />
                    Previous Week
                  </Button>
                  <span className="font-medium">{getWeekRangeDisplay()}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setWeekOffset(weekOffset + 1)}
                    disabled={weekOffset >= 0}
                    className="gap-2"
                  >
                    Next Week
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>

                {/* Weekly Summary Stats */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <Card>
                    <CardContent className="pt-4 pb-3">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-blue-600">{weeklyStats.totalHours}h</p>
                        <p className="text-xs text-muted-foreground">Total Hours</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 pb-3">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-green-600">{weeklyStats.daysWorked}</p>
                        <p className="text-xs text-muted-foreground">Days Worked</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 pb-3">
                      <div className="text-center">
                        <p className="text-2xl font-bold">{weeklyStats.avgHoursPerDay}h</p>
                        <p className="text-xs text-muted-foreground">Avg/Day</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 pb-3">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-yellow-600">
                          {formatDuration(weeklyStats.totalBreakMinutes)}
                        </p>
                        <p className="text-xs text-muted-foreground">Break Time</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 pb-3">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-cyan-600">
                          {formatDuration(weeklyStats.totalPauseMinutes)}
                        </p>
                        <p className="text-xs text-muted-foreground">Pause Time</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Weekly Timesheet Table */}
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Clock In</TableHead>
                        <TableHead>Clock Out</TableHead>
                        <TableHead className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Coffee className="h-3 w-3" />
                            Break
                          </div>
                        </TableHead>
                        <TableHead className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Pause className="h-3 w-3" />
                            Pause
                          </div>
                        </TableHead>
                        <TableHead>Total Hours</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {weeklyLogs.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                            No attendance records for this week
                          </TableCell>
                        </TableRow>
                      ) : (
                        weeklyLogs.map((log) => {
                          const workHours = calculateWorkTime(log);
                          const status = getWorkStatus(log);

                          return (
                            <TableRow key={log.id}>
                              <TableCell className="font-medium">{formatDate(log.clock_in)}</TableCell>
                              <TableCell className="text-green-600 font-mono">{formatTime(log.clock_in)}</TableCell>
                              <TableCell className="text-red-600 font-mono">{formatTime(log.clock_out)}</TableCell>
                              <TableCell className="text-center text-yellow-600">
                                {log.total_break_minutes > 0 ? formatDuration(log.total_break_minutes) : "-"}
                              </TableCell>
                              <TableCell className="text-center text-cyan-600">
                                {log.total_pause_minutes > 0 ? formatDuration(log.total_pause_minutes) : "-"}
                              </TableCell>
                              <TableCell className="font-bold">
                                {workHours !== null ? `${workHours.toFixed(2)}h` : "-"}
                              </TableCell>
                              <TableCell>
                                <Badge variant={status.variant}>{status.label}</Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              {/* Monthly View */}
              <TabsContent value="month" className="space-y-4 mt-4">
                {/* Monthly Summary Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Card>
                    <CardContent className="pt-4 pb-3">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-blue-600">{monthlyStats.totalHours}h</p>
                        <p className="text-xs text-muted-foreground">Total Hours</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 pb-3">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-green-600">{monthlyStats.daysWorked}</p>
                        <p className="text-xs text-muted-foreground">Days Worked</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 pb-3">
                      <div className="text-center">
                        <p className="text-2xl font-bold">{monthlyStats.avgHoursPerDay}h</p>
                        <p className="text-xs text-muted-foreground">Avg/Day</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 pb-3">
                      <div className="text-center flex flex-col items-center">
                        <div className="flex items-center gap-1">
                          <TrendingUp className="h-4 w-4 text-success" />
                          <p className="text-2xl font-bold text-success">{monthlyStats.attendanceRate}%</p>
                        </div>
                        <p className="text-xs text-muted-foreground">Attendance</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Monthly Timesheet Table */}
                <div className="rounded-lg border max-h-[400px] overflow-y-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background">
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Clock In</TableHead>
                        <TableHead>Clock Out</TableHead>
                        <TableHead className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Coffee className="h-3 w-3" />
                            Break
                          </div>
                        </TableHead>
                        <TableHead className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Pause className="h-3 w-3" />
                            Pause
                          </div>
                        </TableHead>
                        <TableHead>Total Hours</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {monthlyLogs.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                            No attendance records for this month
                          </TableCell>
                        </TableRow>
                      ) : (
                        monthlyLogs.map((log) => {
                          const workHours = calculateWorkTime(log);
                          const status = getWorkStatus(log);

                          return (
                            <TableRow key={log.id}>
                              <TableCell className="font-medium">{formatDate(log.clock_in)}</TableCell>
                              <TableCell className="text-green-600 font-mono">{formatTime(log.clock_in)}</TableCell>
                              <TableCell className="text-red-600 font-mono">{formatTime(log.clock_out)}</TableCell>
                              <TableCell className="text-center text-yellow-600">
                                {log.total_break_minutes > 0 ? formatDuration(log.total_break_minutes) : "-"}
                              </TableCell>
                              <TableCell className="text-center text-cyan-600">
                                {log.total_pause_minutes > 0 ? formatDuration(log.total_pause_minutes) : "-"}
                              </TableCell>
                              <TableCell className="font-bold">
                                {workHours !== null ? `${workHours.toFixed(2)}h` : "-"}
                              </TableCell>
                              <TableCell>
                                <Badge variant={status.variant}>{status.label}</Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
