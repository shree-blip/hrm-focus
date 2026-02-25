import { useState, Fragment, useMemo } from "react";
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
  User,
  Mail,
  Timer,
  Pause,
  CalendarRange,
  Pencil,
} from "lucide-react";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useLeaveRequests } from "@/hooks/useLeaveRequests";
import { useTeamAttendance, DateRangeType, getDateRangeFromType } from "@/hooks/useTeamAttendance";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { EditAttendanceDialog } from "@/components/reports/EditAttendanceDialog";

// Types for multi-break support
interface BreakRecord {
  id?: string;
  break_start: string | null;
  break_end: string | null;
  duration_minutes: number;
}

// Types for pause support
interface PauseRecord {
  id?: string;
  pause_start: string | null;
  pause_end: string | null;
  duration_minutes: number;
}

interface DailyAttendanceRecord {
  id?: string;
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
  // Pause support
  pause_start?: string | null;
  pause_end?: string | null;
  pauses?: PauseRecord[];
  total_pause_minutes?: number;
}

// Helper to get human-readable date range label
const getDateRangeLabel = (rangeType: DateRangeType): string => {
  const { start, end } = getDateRangeFromType(rangeType);
  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };
  return `${formatDate(start)} - ${formatDate(end)}`;
};

const Reports = () => {
  const { requests, loading: leaveLoading } = useLeaveRequests();
  const { isVP } = useAuth();
  const [dateRange, setDateRange] = useState<DateRangeType>("this-month");

  // Pass dateRange to the hook so it fetches data for the selected period
  const { teamAttendance, dailyAttendance, loading: attendanceLoading, refetch: refetchAttendance } = useTeamAttendance(dateRange);

  const [activeTab, setActiveTab] = useState("daily");
  const [searchDate, setSearchDate] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState<string>("all");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState("");

  // VP edit state
  const [editRecord, setEditRecord] = useState<any>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

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

  // Get unique employees list from daily attendance
  const employeesList = useMemo(() => {
    const employeesMap = new Map<string, { user_id: string; employee_name: string; email: string }>();
    dailyAttendance.forEach((att) => {
      const typedAtt = att as DailyAttendanceRecord;
      if (!employeesMap.has(typedAtt.user_id)) {
        employeesMap.set(typedAtt.user_id, {
          user_id: typedAtt.user_id,
          employee_name: typedAtt.employee_name,
          email: typedAtt.email,
        });
      }
    });
    return Array.from(employeesMap.values()).sort((a, b) => a.employee_name.localeCompare(b.employee_name));
  }, [dailyAttendance]);

  // Filter employees list based on search query
  const filteredEmployeesList = useMemo(() => {
    if (!employeeSearchQuery.trim()) return employeesList;
    const query = employeeSearchQuery.toLowerCase();
    return employeesList.filter(
      (emp) => emp.employee_name.toLowerCase().includes(query) || emp.email.toLowerCase().includes(query),
    );
  }, [employeesList, employeeSearchQuery]);

  // Filter daily attendance by search date and selected employee
  const filteredDailyAttendance = useMemo(() => {
    let filtered = dailyAttendance;

    // Filter by employee
    if (selectedEmployee !== "all") {
      filtered = filtered.filter((att) => {
        const typedAtt = att as DailyAttendanceRecord;
        return typedAtt.user_id === selectedEmployee;
      });
    }

    // Filter by date
    if (searchDate) {
      filtered = filtered.filter((att) => {
        const attDate = formatDate(att.clock_in);
        return attDate === searchDate;
      });
    }

    return filtered;
  }, [dailyAttendance, selectedEmployee, searchDate]);

  // Helper function to get breaks from attendance record (handles both legacy and new format)
  const getBreaks = (att: DailyAttendanceRecord): BreakRecord[] => {
    if (att.breaks && att.breaks.length > 0) {
      return att.breaks;
    }

    // Legacy handling for single break
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

  // Helper function to get pauses from attendance record
  const getPauses = (att: DailyAttendanceRecord): PauseRecord[] => {
    // If pauses array exists and has data, use it
    if (att.pauses && att.pauses.length > 0) {
      return att.pauses;
    }

    // Legacy support: if single pause_start/pause_end exists, convert to array
    if (att.pause_start) {
      return [
        {
          pause_start: att.pause_start,
          pause_end: att.pause_end || null,
          duration_minutes: att.total_pause_minutes || 0,
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

  // Calculate total pause time from pauses array
  const calculateTotalPauseMinutes = (att: DailyAttendanceRecord): number => {
    // First check if total_pause_minutes is directly available
    if (att.total_pause_minutes !== undefined && att.total_pause_minutes !== null) {
      return att.total_pause_minutes;
    }

    const pauses = getPauses(att);

    if (pauses.length === 0) {
      return 0;
    }

    return pauses.reduce((total, pause) => {
      if (pause.duration_minutes) {
        return total + pause.duration_minutes;
      }

      // Calculate duration if not provided
      if (pause.pause_start && pause.pause_end) {
        const start = new Date(pause.pause_start).getTime();
        const end = new Date(pause.pause_end).getTime();
        const durationMs = end - start;
        return total + Math.round(durationMs / (1000 * 60));
      }

      return total;
    }, 0);
  };

  // Calculate total working hours (clock out - clock in - total break time - total pause time)
  const calculateTotalHours = (att: DailyAttendanceRecord): number | null => {
    // If not clocked out yet, return null
    if (!att.clock_out) {
      return null;
    }

    const clockIn = new Date(att.clock_in).getTime();
    const clockOut = new Date(att.clock_out).getTime();
    const totalBreakMinutes = calculateTotalBreakMinutes(att);
    const totalPauseMinutes = calculateTotalPauseMinutes(att);

    // Calculate total time in milliseconds
    const totalTimeMs = clockOut - clockIn;

    // Convert to hours
    const totalHours = totalTimeMs / (1000 * 60 * 60);

    // Subtract both break and pause time — both are non-working states
    const breakHours = totalBreakMinutes / 60;
    const pauseHours = totalPauseMinutes / 60;

    return Math.max(0, totalHours - breakHours - pauseHours);
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
    totalPauseTime: filteredDailyAttendance.reduce(
      (sum, att) => sum + calculateTotalPauseMinutes(att as DailyAttendanceRecord),
      0,
    ),
    totalPauseCount: filteredDailyAttendance.reduce(
      (sum, att) => sum + getPauses(att as DailyAttendanceRecord).length,
      0,
    ),
  };

  // Calculate selected employee summary
  const selectedEmployeeSummary = useMemo(() => {
    if (selectedEmployee === "all") return null;

    const employeeRecords = dailyAttendance.filter((att) => {
      const typedAtt = att as DailyAttendanceRecord;
      return typedAtt.user_id === selectedEmployee;
    });

    if (employeeRecords.length === 0) return null;

    const firstRecord = employeeRecords[0] as DailyAttendanceRecord;
    const completedRecords = employeeRecords.filter((att) => (att as DailyAttendanceRecord).clock_out);

    const totalHoursWorked = completedRecords.reduce((sum, att) => {
      const hours = calculateTotalHours(att as DailyAttendanceRecord);
      return sum + (hours || 0);
    }, 0);

    const totalBreakMinutes = employeeRecords.reduce(
      (sum, att) => sum + calculateTotalBreakMinutes(att as DailyAttendanceRecord),
      0,
    );

    const totalPauseMinutes = employeeRecords.reduce(
      (sum, att) => sum + calculateTotalPauseMinutes(att as DailyAttendanceRecord),
      0,
    );

    const totalBreaks = employeeRecords.reduce((sum, att) => sum + getBreaks(att as DailyAttendanceRecord).length, 0);
    const totalPauses = employeeRecords.reduce((sum, att) => sum + getPauses(att as DailyAttendanceRecord).length, 0);

    // Get date range
    const dates = employeeRecords.map((att) => new Date((att as DailyAttendanceRecord).clock_in).getTime());
    const firstDate = new Date(Math.min(...dates));
    const lastDate = new Date(Math.max(...dates));

    return {
      employee_name: firstRecord.employee_name,
      email: firstRecord.email,
      totalDaysWorked: employeeRecords.length,
      totalHoursWorked: totalHoursWorked.toFixed(1),
      avgHoursPerDay: completedRecords.length > 0 ? (totalHoursWorked / completedRecords.length).toFixed(1) : "0",
      totalBreakMinutes,
      totalPauseMinutes,
      totalBreaks,
      totalPauses,
      avgBreakPerDay: employeeRecords.length > 0 ? Math.round(totalBreakMinutes / employeeRecords.length) : 0,
      avgPausePerDay: employeeRecords.length > 0 ? Math.round(totalPauseMinutes / employeeRecords.length) : 0,
      dateRange: {
        from: formatDate(firstDate.toISOString()),
        to: formatDate(lastDate.toISOString()),
      },
      completedDays: completedRecords.length,
      inProgressDays: employeeRecords.length - completedRecords.length,
    };
  }, [selectedEmployee, dailyAttendance]);

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

  const clearFilters = () => {
    setSearchDate("");
    setSelectedEmployee("all");
  };

  const exportToCSV = (type: "leave" | "attendance" | "daily") => {
    let csvContent = "";
    let filename = "";
    const today = new Date();
    const dateStr = formatDate(today.toISOString());

    if (type === "leave") {
      // Group leave requests by employee and month
      const employeeMonthlyLeave: Record<string, Record<string, number>> = {};
      const employeeNames: Record<string, string> = {};

      // Get all months in the selected date range
      const { start: rangeStart, end: rangeEnd } = getDateRangeFromType(dateRange);
      const allMonths: string[] = [];
      const currentMonth = new Date(rangeStart);
      while (currentMonth <= rangeEnd) {
        const monthKey = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, "0")}`;
        allMonths.push(monthKey);
        currentMonth.setMonth(currentMonth.getMonth() + 1);
      }

      // Calculate monthly totals per employee
      requests.forEach((r) => {
        if (r.status !== "approved") return; // Only count approved leaves
        const name = r.profile ? `${r.profile.first_name} ${r.profile.last_name}` : "Unknown";
        const startDate = new Date(r.start_date);
        const monthKey = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, "0")}`;

        if (!employeeMonthlyLeave[name]) {
          employeeMonthlyLeave[name] = {};
          employeeNames[name] = name;
        }
        employeeMonthlyLeave[name][monthKey] = (employeeMonthlyLeave[name][monthKey] || 0) + r.days;
      });

      // Build CSV - First section: Detailed leave requests
      csvContent = "=== DETAILED LEAVE REQUESTS ===\n";
      csvContent += "Employee,Leave Type,Start Date,End Date,Days,Status,Reason\n";
      requests.forEach((r) => {
        const name = r.profile ? `${r.profile.first_name} ${r.profile.last_name}` : "Unknown";
        csvContent += `"${name}","${r.leave_type}","${r.start_date}","${r.end_date}",${r.days},"${r.status}","${r.reason || ""}"\n`;
      });

      // Build CSV - Second section: Monthly summary per employee
      csvContent += "\n=== MONTHLY LEAVE SUMMARY (Approved Only) ===\n";
      const monthHeaders = allMonths.map((m) => {
        const [year, month] = m.split("-");
        return new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString("en-US", {
          month: "short",
          year: "numeric",
        });
      });
      csvContent += `Employee,${monthHeaders.join(",")},Total Leave Days\n`;

      // Sort employees by name
      const sortedEmployees = Object.keys(employeeMonthlyLeave).sort();
      let grandTotalPerMonth: Record<string, number> = {};
      allMonths.forEach((m) => {
        grandTotalPerMonth[m] = 0;
      });
      let grandTotal = 0;

      sortedEmployees.forEach((name) => {
        const monthlyData = employeeMonthlyLeave[name];
        let employeeTotal = 0;
        const monthValues = allMonths.map((m) => {
          const days = monthlyData[m] || 0;
          employeeTotal += days;
          grandTotalPerMonth[m] += days;
          return days;
        });
        grandTotal += employeeTotal;
        csvContent += `"${name}",${monthValues.join(",")},${employeeTotal}\n`;
      });

      // Add aggregate totals row
      const aggregateMonthValues = allMonths.map((m) => grandTotalPerMonth[m]);
      csvContent += `"TOTAL (All Employees)",${aggregateMonthValues.join(",")},${grandTotal}\n`;

      filename = `leave-report-${dateStr}.csv`;
    } else if (type === "attendance") {
      csvContent = "Employee,Email,Days Worked,Total Hours\n";
      teamAttendance.forEach((emp) => {
        csvContent += `"${emp.employee_name}","${emp.email}",${emp.days_worked},${emp.total_hours}\n`;
      });
      filename = `attendance-summary-${dateRange}-${dateStr}.csv`;
    } else if (type === "daily") {
      // Find maximum number of breaks and pauses across all records
      const maxBreaks = Math.max(
        1,
        filteredDailyAttendance.reduce((max, att) => {
          const breaks = getBreaks(att as DailyAttendanceRecord);
          return Math.max(max, breaks.length);
        }, 0),
      );

      const maxPauses = Math.max(
        1,
        filteredDailyAttendance.reduce((max, att) => {
          const pauses = getPauses(att as DailyAttendanceRecord);
          return Math.max(max, pauses.length);
        }, 0),
      );

      // Build dynamic header with individual break and pause columns
      let header = "Date,Employee,Email,Clock In";

      // Add columns for each possible break
      for (let i = 1; i <= maxBreaks; i++) {
        header += `,Break ${i} Start,Break ${i} End,Break ${i} Duration (min)`;
      }
      header += ",Total Breaks Count,Total Break Time (min)";

      // Add columns for each possible pause
      for (let i = 1; i <= maxPauses; i++) {
        header += `,Pause ${i} Start,Pause ${i} End,Pause ${i} Duration (min)`;
      }
      header += ",Total Pauses Count,Total Pause Time (min)";

      header += ",Clock Out,Total Hours (excl. breaks & pauses),Status\n";
      csvContent = header;

      filteredDailyAttendance.forEach((att) => {
        const typedAtt = att as DailyAttendanceRecord;
        const date = formatDate(typedAtt.clock_in);
        const clockIn = formatTime24(typedAtt.clock_in);
        const clockOut = formatTime24(typedAtt.clock_out);
        const breaks = getBreaks(typedAtt);
        const pauses = getPauses(typedAtt);
        const totalBreakMinutes = calculateTotalBreakMinutes(typedAtt);
        const totalPauseMinutes = calculateTotalPauseMinutes(typedAtt);
        const totalHours = calculateTotalHours(typedAtt);
        const status = getWorkStatus(totalHours, typedAtt.clock_out).label;

        let row = `"${date}","${typedAtt.employee_name}","${typedAtt.email}","${clockIn}"`;

        // Add each break's individual data
        for (let i = 0; i < maxBreaks; i++) {
          if (breaks[i]) {
            const brk = breaks[i];
            const breakStart = formatTime24(brk.break_start);
            const breakEnd = formatTime24(brk.break_end);
            let breakDuration = brk.duration_minutes || 0;
            if (!breakDuration && brk.break_start && brk.break_end) {
              const start = new Date(brk.break_start).getTime();
              const end = new Date(brk.break_end).getTime();
              breakDuration = Math.round((end - start) / (1000 * 60));
            }
            row += `,"${breakStart}","${breakEnd}",${breakDuration}`;
          } else {
            row += `,"-","-",0`;
          }
        }
        row += `,${breaks.length},${totalBreakMinutes}`;

        // Add each pause's individual data
        for (let i = 0; i < maxPauses; i++) {
          if (pauses[i]) {
            const pause = pauses[i];
            const pauseStart = formatTime24(pause.pause_start);
            const pauseEnd = formatTime24(pause.pause_end);
            let pauseDuration = pause.duration_minutes || 0;
            if (!pauseDuration && pause.pause_start && pause.pause_end) {
              const start = new Date(pause.pause_start).getTime();
              const end = new Date(pause.pause_end).getTime();
              pauseDuration = Math.round((end - start) / (1000 * 60));
            }
            row += `,"${pauseStart}","${pauseEnd}",${pauseDuration}`;
          } else {
            row += `,"-","-",0`;
          }
        }
        row += `,${pauses.length},${totalPauseMinutes}`;

        const totalHoursStr = totalHours !== null ? totalHours.toFixed(2) : "In Progress";
        row += `,"${clockOut}",${totalHoursStr},"${status}"\n`;
        csvContent += row;
      });

      // Add employee name to filename if filtered
      const employeeSuffix =
        selectedEmployee !== "all" && selectedEmployeeSummary
          ? `-${selectedEmployeeSummary.employee_name.replace(/\s+/g, "-")}`
          : "";
      filename = `daily-attendance${employeeSuffix}-${dateRange}-${dateStr}.csv`;
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
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <CalendarRange className="h-4 w-4 text-muted-foreground" />
            <Select value={dateRange} onValueChange={(value) => setDateRange(value as DateRangeType)}>
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
          {/* Show current date range */}
          <Badge variant="outline" className="text-xs whitespace-nowrap">
            {getDateRangeLabel(dateRange)}
          </Badge>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3 sm:w-auto lg:w-[600px] h-auto gap-1">
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
                  <CardDescription>Team attendance data for {getDateRangeLabel(dateRange)}</CardDescription>
                </div>
                <Button onClick={() => exportToCSV("attendance")} className="gap-2">
                  <Download className="h-4 w-4" />
                  Export CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {teamAttendance.length === 0 ? (
                <p className="text-center py-8 text-slate-600">No attendance data available for this period</p>
              ) : (
                <div className="overflow-x-auto">
                  <div className="min-w-[600px] space-y-2">
                    <div className="grid grid-cols-4 gap-4 p-3 bg-slate-100 rounded-lg text-sm font-medium">
                      <span>Employee</span>
                      <span>Email</span>
                      <span>Days Worked</span>
                      <span>Total Hours</span>
                    </div>
                    {teamAttendance.slice(0, 10).map((emp) => (
                      <div
                        key={emp.user_id}
                        className="grid grid-cols-4 gap-4 p-3 rounded-lg hover:bg-slate-50 text-sm"
                      >
                        <span>{emp.employee_name}</span>
                        <span className="text-slate-600">{emp.email}</span>
                        <span>{emp.days_worked}</span>
                        <span>{emp.total_hours}h</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* DAILY ATTENDANCE TAB - Updated with pause tracking */}
        <TabsContent value="daily" className="space-y-6">
          {/* Employee Filter Section */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="h-5 w-5" />
                Filter by Employee
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex-1 min-w-[250px]">
                  <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select an employee" />
                    </SelectTrigger>
                    <SelectContent>
                      <div className="p-2 sticky top-0 bg-background">
                        <Input
                          placeholder="Search employee..."
                          value={employeeSearchQuery}
                          onChange={(e) => setEmployeeSearchQuery(e.target.value)}
                          className="h-8"
                        />
                      </div>
                      <SelectItem value="all">All Employees</SelectItem>
                      {filteredEmployeesList.map((emp) => (
                        <SelectItem key={emp.user_id} value={emp.user_id}>
                          {emp.employee_name}
                        </SelectItem>
                      ))}
                      {filteredEmployeesList.length === 0 && employeeSearchQuery && (
                        <div className="p-2 text-sm text-muted-foreground text-center">No employees found</div>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <Input
                  type="date"
                  value={searchDate}
                  onChange={(e) => setSearchDate(e.target.value)}
                  placeholder="Filter by date"
                  className="w-[180px]"
                />
                {(searchDate || selectedEmployee !== "all") && (
                  <Button variant="outline" onClick={clearFilters}>
                    Clear All Filters
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Selected Employee Summary Card - Updated with pause info */}
          {selectedEmployeeSummary && (
            <Card className="border-blue-200 bg-blue-50/50">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-blue-100">
                      <User className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">{selectedEmployeeSummary.employee_name}</CardTitle>
                      <CardDescription className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {selectedEmployeeSummary.email}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-sm">
                    {selectedEmployeeSummary.dateRange.from} to {selectedEmployeeSummary.dateRange.to}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 overflow-x-auto pb-2">
                  <div className="bg-white p-4 rounded-lg border min-w-[120px]">
                    <p className="text-sm text-slate-600">Days Worked</p>
                    <p className="text-2xl font-bold text-blue-600">{selectedEmployeeSummary.totalDaysWorked}</p>
                  </div>
                  <div className="bg-white p-4 rounded-lg border min-w-[120px]">
                    <p className="text-sm text-slate-600">Total Hours</p>
                    <p className="text-2xl font-bold text-green-600">{selectedEmployeeSummary.totalHoursWorked}h</p>
                  </div>
                  <div className="bg-white p-4 rounded-lg border min-w-[120px]">
                    <p className="text-sm text-slate-600">Avg Hours/Day</p>
                    <p className="text-2xl font-bold">{selectedEmployeeSummary.avgHoursPerDay}h</p>
                  </div>
                  <div className="bg-white p-4 rounded-lg border min-w-[120px]">
                    <p className="text-sm text-slate-600">Total Breaks</p>
                    <p className="text-2xl font-bold text-yellow-600">{selectedEmployeeSummary.totalBreaks}</p>
                  </div>
                  <div className="bg-white p-4 rounded-lg border min-w-[120px]">
                    <p className="text-sm text-slate-600">Break Time</p>
                    <p className="text-2xl font-bold text-orange-600">
                      {formatBreakDuration(selectedEmployeeSummary.totalBreakMinutes)}
                    </p>
                  </div>
                  <div className="bg-white p-4 rounded-lg border min-w-[120px]">
                    <p className="text-sm text-slate-600">Total Pauses</p>
                    <p className="text-2xl font-bold text-cyan-600">{selectedEmployeeSummary.totalPauses}</p>
                  </div>
                  <div className="bg-white p-4 rounded-lg border min-w-[120px]">
                    <p className="text-sm text-slate-600">Pause Time</p>
                    <p className="text-2xl font-bold text-indigo-600">
                      {formatBreakDuration(selectedEmployeeSummary.totalPauseMinutes)}
                    </p>
                  </div>
                  <div className="bg-white p-4 rounded-lg border min-w-[120px]">
                    <p className="text-sm text-slate-600">Avg Pause/Day</p>
                    <p className="text-2xl font-bold text-purple-600">
                      {formatBreakDuration(selectedEmployeeSummary.avgPausePerDay)}
                    </p>
                  </div>
                </div>
                {selectedEmployeeSummary.inProgressDays > 0 && (
                  <p className="text-sm text-slate-500 mt-4">
                    <Timer className="h-4 w-4 inline mr-1" />
                    {selectedEmployeeSummary.inProgressDays} day(s) still in progress
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Stats Cards - Updated with pause stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
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
                    <p className="text-xs text-slate-400">excl. breaks & pauses</p>
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
                    <p className="text-sm font-medium text-slate-600">Breaks Taken</p>
                    <p className="text-3xl font-bold">{dailyStats.totalBreakCount}</p>
                  </div>
                  <div className="p-3 rounded-full bg-orange-100">
                    <Coffee className="h-6 w-6 text-orange-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600">Total Pause Time</p>
                    <p className="text-3xl font-bold">{formatBreakDuration(dailyStats.totalPauseTime)}</p>
                  </div>
                  <div className="p-3 rounded-full bg-cyan-100">
                    <Pause className="h-6 w-6 text-cyan-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600">Pauses Taken</p>
                    <p className="text-3xl font-bold">{dailyStats.totalPauseCount}</p>
                  </div>
                  <div className="p-3 rounded-full bg-indigo-100">
                    <Pause className="h-6 w-6 text-indigo-600" />
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
                  <CardDescription>
                    Detailed time tracking for {getDateRangeLabel(dateRange)}
                    {selectedEmployee !== "all" && selectedEmployeeSummary && (
                      <span className="ml-2 text-blue-600">
                        — Showing {selectedEmployeeSummary.employee_name}'s records
                      </span>
                    )}
                  </CardDescription>
                </div>
                <Button onClick={() => exportToCSV("daily")} className="gap-2">
                  <Download className="h-4 w-4" />
                  Export CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {filteredDailyAttendance.length === 0 ? (
                <p className="text-center py-8 text-slate-600">
                  {searchDate || selectedEmployee !== "all"
                    ? "No records found for the selected filters"
                    : `No daily attendance records available for ${getDateRangeLabel(dateRange)}`}
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
                        <th className="text-left p-3 font-medium">Break Time</th>
                        <th className="text-left p-3 font-medium">Pauses</th>
                        <th className="text-left p-3 font-medium">Pause Time</th>
                        <th className="text-left p-3 font-medium">Clock Out</th>
                        <th className="text-left p-3 font-medium">Total Hrs</th>
                        <th className="text-left p-3 font-medium">Status</th>
                        {isVP && <th className="text-left p-3 font-medium w-10">Edit</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDailyAttendance.map((att, index) => {
                        const typedAtt = att as DailyAttendanceRecord;
                        const breaks = getBreaks(typedAtt);
                        const pauses = getPauses(typedAtt);
                        const totalBreakMinutes = calculateTotalBreakMinutes(typedAtt);
                        const totalPauseMinutes = calculateTotalPauseMinutes(typedAtt);
                        const totalHours = calculateTotalHours(typedAtt);
                        const status = getWorkStatus(totalHours, typedAtt.clock_out);
                        const rowKey = `${typedAtt.user_id}-${typedAtt.clock_in}-${index}`;
                        const isExpanded = expandedRows.has(rowKey);
                        const hasMultipleBreaks = breaks.length > 1;
                        const hasMultiplePauses = pauses.length > 1;
                        const hasExpandableContent = hasMultipleBreaks || hasMultiplePauses;

                        return (
                          <Fragment key={rowKey}>
                            <tr className="border-b hover:bg-slate-50">
                              <td className="p-3">
                                {hasExpandableContent && (
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
                                  <span className="text-slate-400">-</span>
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

                              <td className="p-3 font-medium text-yellow-600">
                                {totalBreakMinutes > 0 ? formatBreakDuration(totalBreakMinutes) : "-"}
                              </td>
                              <td className="p-3">
                                {pauses.length === 0 ? (
                                  <span className="text-slate-400">-</span>
                                ) : pauses.length === 1 ? (
                                  <span className="text-cyan-600 font-mono">
                                    {formatTime24(pauses[0].pause_start)} - {formatTime24(pauses[0].pause_end)}
                                  </span>
                                ) : (
                                  <Badge variant="outline" className="gap-1 border-cyan-300 text-cyan-600">
                                    <Pause className="h-3 w-3" />
                                    {pauses.length} pauses
                                  </Badge>
                                )}
                              </td>
                              <td className="p-3 font-medium text-cyan-600">
                                {totalPauseMinutes > 0 ? formatBreakDuration(totalPauseMinutes) : "-"}
                              </td>
                              <td className="p-3 text-red-600 font-mono">{formatTime24(typedAtt.clock_out)}</td>
                              <td className="p-3 font-bold">
                                {totalHours !== null ? `${totalHours.toFixed(2)}h` : "-"}
                              </td>
                              <td className="p-3">
                                <div className="flex items-center gap-1">
                                  <Badge variant={status.variant}>{status.label}</Badge>
                                  {(att as any).is_edited && (
                                    <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-600 bg-amber-50">
                                      Edited
                                    </Badge>
                                  )}
                                </div>
                              </td>
                              {isVP && (
                                <td className="p-3">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0"
                                    onClick={() => {
                                      setEditRecord({
                                        id: (att as any).id,
                                        employee_name: typedAtt.employee_name,
                                        clock_in: typedAtt.clock_in,
                                        clock_out: typedAtt.clock_out,
                                        break_start: typedAtt.break_start || null,
                                        break_end: typedAtt.break_end || null,
                                        total_break_minutes: typedAtt.total_break_minutes || 0,
                                        pause_start: typedAtt.pause_start || null,
                                        pause_end: typedAtt.pause_end || null,
                                        total_pause_minutes: typedAtt.total_pause_minutes || 0,
                                      });
                                      setEditDialogOpen(true);
                                    }}
                                  >
                                    <Pencil className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                                  </Button>
                                </td>
                              )}
                            </tr>
                            {/* Expanded breaks and pauses detail row */}
                            {hasExpandableContent && isExpanded && (
                              <tr className="bg-slate-50">
                                <td colSpan={isVP ? 12 : 11} className="p-0">
                                  <div className="px-12 py-3 border-b space-y-4">
                                    {/* Breaks detail */}
                                    {hasMultipleBreaks && (
                                      <div>
                                        <p className="text-sm font-medium text-slate-600 mb-2 flex items-center gap-2">
                                          <Coffee className="h-4 w-4 text-yellow-600" />
                                          Break Details:
                                        </p>
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
                                    )}
                                    {/* Pauses detail */}
                                    {hasMultiplePauses && (
                                      <div>
                                        <p className="text-sm font-medium text-slate-600 mb-2 flex items-center gap-2">
                                          <Pause className="h-4 w-4 text-cyan-600" />
                                          Pause Details:
                                        </p>
                                        <div className="space-y-1">
                                          {pauses.map((pause, pauseIndex) => (
                                            <div
                                              key={pauseIndex}
                                              className="flex items-center gap-4 text-sm bg-white p-2 rounded border"
                                            >
                                              <Badge variant="secondary" className="text-xs bg-cyan-100 text-cyan-700">
                                                Pause {pauseIndex + 1}
                                              </Badge>
                                              <span className="text-cyan-600 font-mono">
                                                {formatTime24(pause.pause_start)} - {formatTime24(pause.pause_end)}
                                              </span>
                                              <span className="text-slate-600">
                                                ({pause.duration_minutes || 0} min)
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
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

      {/* VP Edit Attendance Dialog */}
      <EditAttendanceDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        record={editRecord}
        onSaved={refetchAttendance}
      />
    </DashboardLayout>
  );
};

export default Reports;
