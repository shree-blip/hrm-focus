import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLeaveRequests } from "@/hooks/useLeaveRequests";
import { useTeamAttendance } from "@/hooks/useTeamAttendance";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";
import { 
  BarChart3, 
  Download, 
  FileSpreadsheet,
  FileText,
  Calendar,
  Clock,
  Users,
  TrendingUp,
  Loader2
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

const Reports = () => {
  const { requests, loading: leaveLoading } = useLeaveRequests();
  const { teamAttendance, loading: attendanceLoading } = useTeamAttendance();
  const [activeTab, setActiveTab] = useState("leave");
  const [dateRange, setDateRange] = useState("this-month");

  const loading = leaveLoading || attendanceLoading;

  // Calculate leave statistics
  const leaveStats = {
    total: requests.length,
    approved: requests.filter(r => r.status === "approved").length,
    pending: requests.filter(r => r.status === "pending").length,
    rejected: requests.filter(r => r.status === "rejected").length,
    byType: requests.reduce((acc, r) => {
      acc[r.leave_type] = (acc[r.leave_type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
  };

  // Calculate attendance statistics
  const attendanceStats = {
    totalRecords: teamAttendance.length,
    avgHoursWorked: teamAttendance.length > 0 
      ? (teamAttendance.reduce((sum, emp) => sum + emp.total_hours, 0) / teamAttendance.length).toFixed(1)
      : "0",
    lateArrivals: 0, // Would need clock-in time policy to calculate
    totalDaysWorked: teamAttendance.reduce((sum, emp) => sum + emp.days_worked, 0),
  };

  const exportToCSV = (type: "leave" | "attendance") => {
    let csvContent = "";
    let filename = "";

    if (type === "leave") {
      csvContent = "Employee,Leave Type,Start Date,End Date,Days,Status,Reason\n";
      requests.forEach(r => {
        const name = r.profile ? `${r.profile.first_name} ${r.profile.last_name}` : "Unknown";
        csvContent += `"${name}","${r.leave_type}","${r.start_date}","${r.end_date}",${r.days},"${r.status}","${r.reason || ""}"\n`;
      });
      filename = `leave-report-${format(new Date(), "yyyy-MM-dd")}.csv`;
    } else {
      csvContent = "Employee,Email,Days Worked,Total Hours\n";
      teamAttendance.forEach(emp => {
        csvContent += `"${emp.employee_name}","${emp.email}",${emp.days_worked},${emp.total_hours}\n`;
      });
      filename = `attendance-report-${format(new Date(), "yyyy-MM-dd")}.csv`;
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 animate-fade-in">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Reports & Analytics</h1>
          <p className="text-muted-foreground mt-1">View and export HR reports</p>
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
        <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
          <TabsTrigger value="leave" className="gap-2">
            <Calendar className="h-4 w-4" />
            Leave Reports
          </TabsTrigger>
          <TabsTrigger value="attendance" className="gap-2">
            <Clock className="h-4 w-4" />
            Attendance Reports
          </TabsTrigger>
        </TabsList>

        <TabsContent value="leave" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="animate-slide-up">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Requests</p>
                    <p className="text-3xl font-display font-bold">{leaveStats.total}</p>
                  </div>
                  <div className="p-3 rounded-full bg-primary/10">
                    <FileText className="h-6 w-6 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="animate-slide-up" style={{ animationDelay: "100ms" }}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Approved</p>
                    <p className="text-3xl font-display font-bold text-success">{leaveStats.approved}</p>
                  </div>
                  <div className="p-3 rounded-full bg-success/10">
                    <TrendingUp className="h-6 w-6 text-success" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="animate-slide-up" style={{ animationDelay: "200ms" }}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Pending</p>
                    <p className="text-3xl font-display font-bold text-warning">{leaveStats.pending}</p>
                  </div>
                  <div className="p-3 rounded-full bg-warning/10">
                    <Clock className="h-6 w-6 text-warning" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="animate-slide-up" style={{ animationDelay: "300ms" }}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Rejected</p>
                    <p className="text-3xl font-display font-bold text-destructive">{leaveStats.rejected}</p>
                  </div>
                  <div className="p-3 rounded-full bg-destructive/10">
                    <BarChart3 className="h-6 w-6 text-destructive" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="animate-slide-up" style={{ animationDelay: "400ms" }}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="font-display text-lg">Leave by Type</CardTitle>
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
                  <div key={type} className="flex items-center justify-between p-4 rounded-lg bg-accent/30">
                    <div className="flex items-center gap-3">
                      <div className="h-3 w-3 rounded-full bg-primary" />
                      <span className="font-medium">{type}</span>
                    </div>
                    <span className="text-2xl font-display font-bold">{count}</span>
                  </div>
                ))}
                {Object.keys(leaveStats.byType).length === 0 && (
                  <p className="text-center py-8 text-muted-foreground">No leave data available</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attendance" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="animate-slide-up">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Records</p>
                    <p className="text-3xl font-display font-bold">{attendanceStats.totalRecords}</p>
                  </div>
                  <div className="p-3 rounded-full bg-primary/10">
                    <Users className="h-6 w-6 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="animate-slide-up" style={{ animationDelay: "100ms" }}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Avg Hours/Day</p>
                    <p className="text-3xl font-display font-bold">{attendanceStats.avgHoursWorked}h</p>
                  </div>
                  <div className="p-3 rounded-full bg-success/10">
                    <Clock className="h-6 w-6 text-success" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="animate-slide-up" style={{ animationDelay: "200ms" }}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Late Arrivals</p>
                    <p className="text-3xl font-display font-bold text-warning">{attendanceStats.lateArrivals}</p>
                  </div>
                  <div className="p-3 rounded-full bg-warning/10">
                    <Clock className="h-6 w-6 text-warning" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="animate-slide-up" style={{ animationDelay: "300ms" }}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Days Worked</p>
                    <p className="text-3xl font-display font-bold">{attendanceStats.totalDaysWorked}</p>
                  </div>
                  <div className="p-3 rounded-full bg-info/10">
                    <Calendar className="h-6 w-6 text-info" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="animate-slide-up" style={{ animationDelay: "400ms" }}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="font-display text-lg">Attendance Records</CardTitle>
                  <CardDescription>Team attendance data</CardDescription>
                </div>
                <Button onClick={() => exportToCSV("attendance")} className="gap-2">
                  <Download className="h-4 w-4" />
                  Export CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {teamAttendance.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">No attendance data available</p>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-4 gap-4 p-3 bg-muted rounded-lg text-sm font-medium">
                    <span>Employee</span>
                    <span>Email</span>
                    <span>Days Worked</span>
                    <span>Total Hours</span>
                  </div>
                  {teamAttendance.slice(0, 10).map(emp => (
                    <div key={emp.user_id} className="grid grid-cols-4 gap-4 p-3 rounded-lg hover:bg-accent/30 text-sm">
                      <span>{emp.employee_name}</span>
                      <span className="text-muted-foreground">{emp.email}</span>
                      <span>{emp.days_worked}</span>
                      <span>{emp.total_hours}h</span>
                    </div>
                  ))}
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
