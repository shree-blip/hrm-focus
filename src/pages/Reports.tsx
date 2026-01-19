import { useState, Fragment } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  BarChart3,
  Download,
  FileText,
  Calendar,
  Clock,
  Users,
  TrendingUp,
  Loader2,
  Coffee,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useLeaveRequests } from "@/hooks/useLeaveRequests";
import { useTeamAttendance } from "@/hooks/useTeamAttendance";
import { toast } from "@/hooks/use-toast";

// Types for multi-break support
interface BreakRecord {
  id?: string;
  break_start: string | null;
  break_end: string | null;
  duration_minutes: number;
}

interface DailyAttendanceRecord {
  user_id: string;
  employee_name: string;
  email: string;
  clock_in: string;
  clock_out: string | null;
  hours_worked: number;
  // Support both single break (legacy) and multiple breaks
  break_start?: string | null;
  break_end?: string | null;
  breaks?: BreakRecord[];
  total_break_minutes: number;
}

const Reports = () => {
  const { requests, loading: leaveLoading } = useLeaveRequests();
  const { teamAttendance, dailyAttendance, loading: attendanceLoading } = useTeamAttendance();
  const [activeTab, setActiveTab] = useState("daily");
  const [dateRange, setDateRange] = useState("this-month");
  const [searchDate, setSearchDate] = useState("");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const loading = leaveLoading || attendanceLoading;

  // Calculate leave statistics
  const leaveStats = {
    total: requests.length,
    approved: requests.filter((r) => r.status === "approved").length,
    pending: requests.filter((r) => r.status === "pending").length,
    rejected: requests.filter((r) => r.status === "rejected").length,
    byType: requests.reduce(
      (acc, r) => {
        acc[r.leave_type] = (acc[r.leave_type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    ),
  };

  // Calculate attendance statistics
  const attendanceStats = {
    totalRecords: teamAttendance.length,
    avgHoursWorked:
      teamAttendance.length > 0
        ? (teamAttendance.reduce((sum, emp) => sum + emp.total_hours, 0) / teamAttendance.length).toFixed(1)
        : "0",
    lateArrivals: 0,
    totalDaysWorked: teamAttendance.reduce((sum, emp) => sum + emp.days_worked, 0),
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // Filter daily attendance by search date
  const filteredDailyAttendance = searchDate
    ? dailyAttendance.filter((att) => {
        const attDate = formatDate(att.clock_in);
        return attDate === searchDate;
      })
    : dailyAttendance;

  // Helper function to get breaks from attendance record (handles both legacy and new format)
  const getBreaks = (att: DailyAttendanceRecord): BreakRecord[] => {
    // If breaks array exists and has data, use it
    if (att.breaks && att.breaks.length > 0) {
      return att.breaks;
    }

    // Legacy support: if single break_start/break_end exists, convert to array
    if (att.break_start) {
      return [
        {
          break_start: att.break_start,
          break_end: att.break_end || null,
          duration_minutes: att.total_break_minutes || 0,
        },
      ];
    }

    return [];
  };

  // Calculate total break time from breaks array
  const calculateTotalBreakMinutes = (att: DailyAttendanceRecord): number => {
    const breaks = getBreaks(att);

    if (breaks.length === 0) {
      return att.total_break_minutes || 0;
    }

    return breaks.reduce((total, brk) => {
      if (brk.duration_minutes) {
        return total + brk.duration_minutes;
      }

      // Calculate duration if not provided
      if (brk.break_start && brk.break_end) {
        const start = new Date(brk.break_start).getTime();
        const end = new Date(brk.break_end).getTime();
        const durationMs = end - start;
        return total + Math.round(durationMs / (1000 * 60));
      }

      return total;
    }, 0);
  };

  // Calculate total working hours (clock out - clock in - total break time)
  const calculateTotalHours = (att: DailyAttendanceRecord): number | null => {
    // If not clocked out yet, return null
    if (!att.clock_out) {
      return null;
    }

    const clockIn = new Date(att.clock_in).getTime();
    const clockOut = new Date(att.clock_out).getTime();
    const totalBreakMinutes = calculateTotalBreakMinutes(att);

    // Calculate total time in milliseconds
    const totalTimeMs = clockOut - clockIn;

    // Convert to hours and subtract break time
    const totalHours = totalTimeMs / (1000 * 60 * 60);
    const breakHours = totalBreakMinutes / 60;

    return Math.max(0, totalHours - breakHours);
  };

  // Calculate daily attendance stats based on filtered data
  const dailyStats = {
    totalRecords: filteredDailyAttendance.length,
    avgTotalHours: (() => {
      const completedRecords = filteredDailyAttendance.filter((att) => (att as DailyAttendanceRecord).clock_out);
      if (completedRecords.length === 0) return "0";
      const totalHours = completedRecords.reduce((sum, att) => {
        const hours = calculateTotalHours(att as DailyAttendanceRecord);
        return sum + (hours || 0);
      }, 0);
      return (totalHours / completedRecords.length).toFixed(1);
    })(),
    totalBreakTime: filteredDailyAttendance.reduce(
      (sum, att) => sum + calculateTotalBreakMinutes(att as DailyAttendanceRecord),
      0,
    ),
    totalBreakCount: filteredDailyAttendance.reduce(
      (sum, att) => sum + getBreaks(att as DailyAttendanceRecord).length,
      0,
    ),
  };

  const formatTime24 = (dateString: string | null) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  };

  const formatBreakDuration = (minutes: number): string => {
    if (minutes < 60) {
      return `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const getWorkStatus = (totalHours: number | null, clockOut: string | null) => {
    if (!clockOut || totalHours === null) return { label: "In Progress", variant: "secondary" as const };
    if (totalHours >= 8.5) return { label: "Overtime", variant: "default" as const };
    if (totalHours >= 7.5 && totalHours < 8.5) return { label: "Complete", variant: "default" as const };
    return { label: "Short Time", variant: "destructive" as const };
  };

  const toggleRowExpanded = (rowKey: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowKey)) {
        next.delete(rowKey);
      } else {
        next.add(rowKey);
      }
      return next;
    });
  };

  const exportToCSV = (type: "leave" | "attendance" | "daily") => {
    let csvContent = "";
    let filename = "";
    const today = new Date();
    const dateStr = formatDate(today.toISOString());

    if (type === "leave") {
      csvContent = "Employee,Leave Type,Start Date,End Date,Days,Status,Reason\n";
      requests.forEach((r) => {
        const name = r.profile ? `${r.profile.first_name} ${r.profile.last_name}` : "Unknown";
        csvContent += `"${name}","${r.leave_type}","${r.start_date}","${r.end_date}",${r.days},"${r.status}","${r.reason || ""}"\n`;
      });
      filename = `leave-report-${dateStr}.csv`;
    } else if (type === "attendance") {
      csvContent = "Employee,Email,Days Worked,Total Hours\n";
      teamAttendance.forEach((emp) => {
        csvContent += `"${emp.employee_name}","${emp.email}",${emp.days_worked},${emp.total_hours}\n`;
      });
      filename = `attendance-summary-${dateStr}.csv`;
    } else if (type === "daily") {
      // Find maximum number of breaks across all records to determine columns needed
      const maxBreaks = Math.max(
        1,
        filteredDailyAttendance.reduce((max, att) => {
          const breaks = getBreaks(att as DailyAttendanceRecord);
          return Math.max(max, breaks.length);
        }, 0),
      );

      // Build dynamic header with individual break columns
      let header = "Date,Employee,Email,Clock In";

      // Add columns for each possible break (Start, End, Duration for each)
      for (let i = 1; i <= maxBreaks; i++) {
        header += `,Break ${i} Start,Break ${i} End,Break ${i} Duration (min)`;
      }

      header += ",Total Breaks Count,Total Break Time (min),Clock Out,Total Hours,Status\n";
      csvContent = header;

      filteredDailyAttendance.forEach((att) => {
        const typedAtt = att as DailyAttendanceRecord;
        const date = formatDate(typedAtt.clock_in);
        const clockIn = formatTime24(typedAtt.clock_in);
        const clockOut = formatTime24(typedAtt.clock_out);
        const breaks = getBreaks(typedAtt);
        const totalBreakMinutes = calculateTotalBreakMinutes(typedAtt);
        const totalHours = calculateTotalHours(typedAtt);
        const status = getWorkStatus(totalHours, typedAtt.clock_out).label;

        let row = `"${date}","${typedAtt.employee_name}","${typedAtt.email}","${clockIn}"`;

        // Add each break's individual data (Start, End, Duration)
        for (let i = 0; i < maxBreaks; i++) {
          if (breaks[i]) {
            const brk = breaks[i];
            const breakStart = formatTime24(brk.break_start);
            const breakEnd = formatTime24(brk.break_end);
            // Calculate individual break duration
            let breakDuration = brk.duration_minutes || 0;
            if (!breakDuration && brk.break_start && brk.break_end) {
              const start = new Date(brk.break_start).getTime();
              const end = new Date(brk.break_end).getTime();
              breakDuration = Math.round((end - start) / (1000 * 60));
            }
            row += `,"${breakStart}","${breakEnd}",${breakDuration}`;
          } else {
            // Empty cells for breaks that don't exist for this record
            row += `,"-","-",0`;
          }
        }

        const totalHoursStr = totalHours !== null ? totalHours.toFixed(2) : "In Progress";

        row += `,${breaks.length},${totalBreakMinutes},"${clockOut}",${totalHoursStr},"${status}"\n`;
        csvContent += row;
      });
      filename = `daily-attendance-${dateStr}.csv`;
    }

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Export Complete",
      description: `${filename} has been downloaded.`,
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

  return (
    <DashboardLayout>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Reports & Analytics</h1>
          <p className="text-slate-600 mt-1">View and export HR reports</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="this-month">This Month</SelectItem>
              <SelectItem value="last-month">Last Month</SelectItem>
              <SelectItem value="this-quarter">This Quarter</SelectItem>
              <SelectItem value="this-year">This Year</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 lg:w-[600px]">
          <TabsTrigger value="leave" className="gap-2">
            <Calendar className="h-4 w-4" />
            Leave Reports
          </TabsTrigger>
          <TabsTrigger value="attendance" className="gap-2">
            <Clock className="h-4 w-4" />
            Attendance Summary
          </TabsTrigger>
          <TabsTrigger value="daily" className="gap-2">
            <Users className="h-4 w-4" />
            Daily Attendance
          </TabsTrigger>
        </TabsList>

        {/* LEAVE REPORTS TAB */}
        <TabsContent value="leave" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600">Total Requests</p>
                    <p className="text-3xl font-bold">{leaveStats.total}</p>
                  </div>
                  <div className="p-3 rounded-full bg-blue-100">
                    <FileText className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600">Approved</p>
                    <p className="text-3xl font-bold text-green-600">{leaveStats.approved}</p>
                  </div>
                  <div className="p-3 rounded-full bg-green-100">
                    <TrendingUp className="h-6 w-6 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600">Pending</p>
                    <p className="text-3xl font-bold text-yellow-600">{leaveStats.pending}</p>
                  </div>
                  <div className="p-3 rounded-full bg-yellow-100">
                    <Clock className="h-6 w-6 text-yellow-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600">Rejected</p>
                    <p className="text-3xl font-bold text-red-600">{leaveStats.rejected}</p>
                  </div>
                  <div className="p-3 rounded-full bg-red-100">
                    <BarChart3 className="h-6 w-6 text-red-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Leave by Type</CardTitle>
                  <CardDescription>Breakdown of leave requests by type</CardDescription>
                </div>
                <Button onClick={() => exportToCSV("leave")} className="gap-2">
                  <Download className="h-4 w-4" />
                  Export CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(leaveStats.byType).map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between p-4 rounded-lg bg-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="h-3 w-3 rounded-full bg-blue-600" />
                      <span className="font-medium">{type}</span>
                    </div>
                    <span className="text-2xl font-bold">{count}</span>
                  </div>
                ))}
                {Object.keys(leaveStats.byType).length === 0 && (
                  <p className="text-center py-8 text-slate-600">No leave data available</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ATTENDANCE SUMMARY TAB */}
        <TabsContent value="attendance" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600">Total Records</p>
                    <p className="text-3xl font-bold">{attendanceStats.totalRecords}</p>
                  </div>
                  <div className="p-3 rounded-full bg-blue-100">
                    <Users className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600">Avg Hours/Day</p>
                    <p className="text-3xl font-bold">{attendanceStats.avgHoursWorked}h</p>
                  </div>
                  <div className="p-3 rounded-full bg-green-100">
                    <Clock className="h-6 w-6 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600">Late Arrivals</p>
                    <p className="text-3xl font-bold text-yellow-600">{attendanceStats.lateArrivals}</p>
                  </div>
                  <div className="p-3 rounded-full bg-yellow-100">
                    <Clock className="h-6 w-6 text-yellow-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600">Total Days Worked</p>
                    <p className="text-3xl font-bold">{attendanceStats.totalDaysWorked}</p>
                  </div>
                  <div className="p-3 rounded-full bg-blue-100">
                    <Calendar className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Attendance Summary</CardTitle>
                  <CardDescription>Team attendance data (aggregated)</CardDescription>
                </div>
                <Button onClick={() => exportToCSV("attendance")} className="gap-2">
                  <Download className="h-4 w-4" />
                  Export CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {teamAttendance.length === 0 ? (
                <p className="text-center py-8 text-slate-600">No attendance data available</p>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-4 gap-4 p-3 bg-slate-100 rounded-lg text-sm font-medium">
                    <span>Employee</span>
                    <span>Email</span>
                    <span>Days Worked</span>
                    <span>Total Hours</span>
                  </div>
                  {teamAttendance.slice(0, 10).map((emp) => (
                    <div key={emp.user_id} className="grid grid-cols-4 gap-4 p-3 rounded-lg hover:bg-slate-50 text-sm">
                      <span>{emp.employee_name}</span>
                      <span className="text-slate-600">{emp.email}</span>
                      <span>{emp.days_worked}</span>
                      <span>{emp.total_hours}h</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* DAILY ATTENDANCE TAB - Updated with single Total Hours column */}
        <TabsContent value="daily" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600">Total Records</p>
                    <p className="text-3xl font-bold">{dailyStats.totalRecords}</p>
                  </div>
                  <div className="p-3 rounded-full bg-blue-100">
                    <Calendar className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600">Avg Total Hours</p>
                    <p className="text-3xl font-bold">{dailyStats.avgTotalHours}h</p>
                    <p className="text-xs text-slate-400">excl. breaks</p>
                  </div>
                  <div className="p-3 rounded-full bg-green-100">
                    <Clock className="h-6 w-6 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600">Total Break Time</p>
                    <p className="text-3xl font-bold">{formatBreakDuration(dailyStats.totalBreakTime)}</p>
                  </div>
                  <div className="p-3 rounded-full bg-yellow-100">
                    <Coffee className="h-6 w-6 text-yellow-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600">Total Breaks Taken</p>
                    <p className="text-3xl font-bold">{dailyStats.totalBreakCount}</p>
                  </div>
                  <div className="p-3 rounded-full bg-purple-100">
                    <Coffee className="h-6 w-6 text-purple-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle className="text-lg">Daily Attendance Records</CardTitle>
                  <CardDescription>Detailed time tracking with multiple breaks (24-hour format)</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={searchDate}
                    onChange={(e) => setSearchDate(e.target.value)}
                    placeholder="Filter by date"
                    className="w-[180px]"
                  />
                  {searchDate && (
                    <Button variant="outline" size="sm" onClick={() => setSearchDate("")}>
                      Clear
                    </Button>
                  )}
                  <Button onClick={() => exportToCSV("daily")} className="gap-2">
                    <Download className="h-4 w-4" />
                    Export CSV
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filteredDailyAttendance.length === 0 ? (
                <p className="text-center py-8 text-slate-600">
                  {searchDate ? "No records found for this date" : "No daily attendance records available"}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-3 font-medium w-8"></th>
                        <th className="text-left p-3 font-medium">Date</th>
                        <th className="text-left p-3 font-medium">Employee</th>
                        <th className="text-left p-3 font-medium">Clock In</th>
                        <th className="text-left p-3 font-medium">Breaks</th>
                        <th className="text-left p-3 font-medium">Total Break</th>
                        <th className="text-left p-3 font-medium">Clock Out</th>
                        <th className="text-left p-3 font-medium">Total Hrs</th>
                        <th className="text-left p-3 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDailyAttendance.map((att, index) => {
                        const typedAtt = att as DailyAttendanceRecord;
                        const breaks = getBreaks(typedAtt);
                        const totalBreakMinutes = calculateTotalBreakMinutes(typedAtt);
                        const totalHours = calculateTotalHours(typedAtt);
                        const status = getWorkStatus(totalHours, typedAtt.clock_out);
                        const rowKey = `${typedAtt.user_id}-${typedAtt.clock_in}-${index}`;
                        const isExpanded = expandedRows.has(rowKey);
                        const hasMultipleBreaks = breaks.length > 1;

                        return (
                          <Fragment key={rowKey}>
                            <tr className="border-b hover:bg-slate-50">
                              <td className="p-3">
                                {hasMultipleBreaks && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0"
                                    onClick={() => toggleRowExpanded(rowKey)}
                                  >
                                    {isExpanded ? (
                                      <ChevronUp className="h-4 w-4" />
                                    ) : (
                                      <ChevronDown className="h-4 w-4" />
                                    )}
                                  </Button>
                                )}
                              </td>
                              <td className="p-3 font-medium">{formatDate(typedAtt.clock_in)}</td>
                              <td className="p-3">
                                <div>
                                  <p className="font-medium">{typedAtt.employee_name}</p>
                                  <p className="text-xs text-slate-600">{typedAtt.email}</p>
                                </div>
                              </td>
                              <td className="p-3 text-green-600 font-mono">{formatTime24(typedAtt.clock_in)}</td>
                              <td className="p-3">
                                {breaks.length === 0 ? (
                                  <span className="text-slate-400">No breaks</span>
                                ) : breaks.length === 1 ? (
                                  <span className="text-yellow-600 font-mono">
                                    {formatTime24(breaks[0].break_start)} - {formatTime24(breaks[0].break_end)}
                                  </span>
                                ) : (
                                  <Badge variant="outline" className="gap-1">
                                    <Coffee className="h-3 w-3" />
                                    {breaks.length} breaks
                                  </Badge>
                                )}
                              </td>
                              <td className="p-3 font-medium">
                                {totalBreakMinutes > 0 ? formatBreakDuration(totalBreakMinutes) : "-"}
                              </td>
                              <td className="p-3 text-red-600 font-mono">{formatTime24(typedAtt.clock_out)}</td>
                              <td className="p-3 font-bold">
                                {totalHours !== null ? `${totalHours.toFixed(2)}h` : "-"}
                              </td>
                              <td className="p-3">
                                <Badge variant={status.variant}>{status.label}</Badge>
                              </td>
                            </tr>
                            {/* Expanded breaks detail row */}
                            {hasMultipleBreaks && isExpanded && (
                              <tr className="bg-slate-50">
                                <td colSpan={9} className="p-0">
                                  <div className="px-12 py-3 border-b">
                                    <p className="text-sm font-medium text-slate-600 mb-2">Break Details:</p>
                                    <div className="space-y-1">
                                      {breaks.map((brk, brkIndex) => (
                                        <div
                                          key={brkIndex}
                                          className="flex items-center gap-4 text-sm bg-white p-2 rounded border"
                                        >
                                          <Badge variant="secondary" className="text-xs">
                                            Break {brkIndex + 1}
                                          </Badge>
                                          <span className="text-yellow-600 font-mono">
                                            {formatTime24(brk.break_start)} - {formatTime24(brk.break_end)}
                                          </span>
                                          <span className="text-slate-600">({brk.duration_minutes || 0} min)</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
};

export default Reports;
