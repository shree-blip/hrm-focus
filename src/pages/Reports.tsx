import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { BarChart3, Download, FileText, Calendar, Clock, Users, TrendingUp, Loader2, Coffee } from "lucide-react";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useLeaveRequests } from "@/hooks/useLeaveRequests";
import { useTeamAttendance } from "@/hooks/useTeamAttendance";
import { toast } from "@/hooks/use-toast";

const Reports = () => {
  const { requests, loading: leaveLoading } = useLeaveRequests();
  const { teamAttendance, dailyAttendance, loading: attendanceLoading } = useTeamAttendance();
  const [activeTab, setActiveTab] = useState("daily");
  const [dateRange, setDateRange] = useState("this-month");
  const [searchDate, setSearchDate] = useState("");

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

  // Calculate daily attendance stats based on filtered data
  const dailyStats = {
    totalRecords: filteredDailyAttendance.length,
    avgWorkHours:
      filteredDailyAttendance.length > 0
        ? (
            filteredDailyAttendance.reduce((sum, att) => sum + att.hours_worked, 0) / filteredDailyAttendance.length
          ).toFixed(1)
        : "0",
    totalBreakTime: filteredDailyAttendance.reduce((sum, att) => sum + (att.total_break_minutes || 0), 0),
  };

  const formatTime24 = (dateString: string | null) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  };

  const getWorkStatus = (hoursWorked: number, clockOut: string | null) => {
    if (!clockOut) return { label: "In Progress", variant: "secondary" as const };
    if (hoursWorked > 8) return { label: "Overtime", variant: "default" as const };
    if (hoursWorked < 8) return { label: "Short Time", variant: "destructive" as const };
    return { label: "Complete", variant: "default" as const };
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
      csvContent =
        "Date,Employee,Email,Clock In,Break Start,Break End,Total Break (min),Clock Out,Hours Worked,Status\n";
      filteredDailyAttendance.forEach((att) => {
        const date = formatDate(att.clock_in);
        const clockIn = formatTime24(att.clock_in);
        const breakStart = formatTime24(att.break_start);
        const breakEnd = formatTime24(att.break_end);
        const clockOut = formatTime24(att.clock_out);
        const breakMinutes = att.total_break_minutes || 0;
        const hoursWorked = att.hours_worked.toFixed(2);
        const status = getWorkStatus(att.hours_worked, att.clock_out).label;

        csvContent += `"${date}","${att.employee_name}","${att.email}","${clockIn}","${breakStart}","${breakEnd}",${breakMinutes},"${clockOut}",${hoursWorked},"${status}"\n`;
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

        {/* DAILY ATTENDANCE TAB */}
        <TabsContent value="daily" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                    <p className="text-sm font-medium text-slate-600">Avg Work Hours</p>
                    <p className="text-3xl font-bold">{dailyStats.avgWorkHours}h</p>
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
                    <p className="text-3xl font-bold">{Math.round(dailyStats.totalBreakTime / 60)}h</p>
                  </div>
                  <div className="p-3 rounded-full bg-yellow-100">
                    <Coffee className="h-6 w-6 text-yellow-600" />
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
                  <CardDescription>Detailed time tracking (24-hour format)</CardDescription>
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
                        <th className="text-left p-3 font-medium">Date</th>
                        <th className="text-left p-3 font-medium">Employee</th>
                        <th className="text-left p-3 font-medium">Clock In</th>
                        <th className="text-left p-3 font-medium">Break Start</th>
                        <th className="text-left p-3 font-medium">Break End</th>
                        <th className="text-left p-3 font-medium">Break (min)</th>
                        <th className="text-left p-3 font-medium">Clock Out</th>
                        <th className="text-left p-3 font-medium">Hours</th>
                        <th className="text-left p-3 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDailyAttendance.map((att, index) => {
                        const status = getWorkStatus(att.hours_worked, att.clock_out);
                        return (
                          <tr key={`${att.user_id}-${att.clock_in}-${index}`} className="border-b hover:bg-slate-50">
                            <td className="p-3 font-medium">{formatDate(att.clock_in)}</td>
                            <td className="p-3">
                              <div>
                                <p className="font-medium">{att.employee_name}</p>
                                <p className="text-xs text-slate-600">{att.email}</p>
                              </div>
                            </td>
                            <td className="p-3 text-green-600 font-mono">{formatTime24(att.clock_in)}</td>
                            <td className="p-3 text-yellow-600 font-mono">{formatTime24(att.break_start)}</td>
                            <td className="p-3 text-yellow-600 font-mono">{formatTime24(att.break_end)}</td>
                            <td className="p-3 font-medium">{att.total_break_minutes || 0}</td>
                            <td className="p-3 text-red-600 font-mono">{formatTime24(att.clock_out)}</td>
                            <td className="p-3 font-bold">{att.hours_worked.toFixed(2)}h</td>
                            <td className="p-3">
                              <Badge variant={status.variant}>{status.label}</Badge>
                            </td>
                          </tr>
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
