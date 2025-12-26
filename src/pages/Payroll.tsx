import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DollarSign,
  Download,
  Calendar,
  TrendingUp,
  Users,
  FileText,
  Calculator,
  Clock,
  Loader2,
  Globe,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { usePayroll } from "@/hooks/usePayroll";
import { useEmployees } from "@/hooks/useEmployees";
import { useTeamAttendance } from "@/hooks/useTeamAttendance";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";

const Payroll = () => {
  const { isVP, isManager } = useAuth();
  const { payrollRuns, loading, region, setRegion, createPayrollRun, processPayroll, exportPayroll, getTaxRates } = usePayroll();
  const { employees } = useEmployees();
  const { teamAttendance, loading: attendanceLoading } = useTeamAttendance();
  const [activeTab, setActiveTab] = useState<"overview" | "attendance" | "contractor">("overview");

  // Filter employees by region
  const regionEmployees = employees.filter(e => e.location === region);
  
  // Calculate stats from real data
  const totalEmployees = regionEmployees.length;
  const avgSalary = regionEmployees.length > 0 
    ? regionEmployees.reduce((sum, e) => sum + (e.salary || 0), 0) / regionEmployees.length 
    : 0;

  // Generate chart data from payroll runs
  const payrollData = payrollRuns
    .filter(r => r.region === region)
    .slice(0, 6)
    .reverse()
    .map(run => ({
      month: format(new Date(run.period_end), "MMM"),
      amount: run.total_gross || 0,
    }));

  // Use mock data if no real data exists
  const displayPayrollData = payrollData.length > 0 ? payrollData : [
    { month: "Jul", amount: 125000 },
    { month: "Aug", amount: 128000 },
    { month: "Sep", amount: 132000 },
    { month: "Oct", amount: 135000 },
    { month: "Nov", amount: 138000 },
    { month: "Dec", amount: 142000 },
  ];

  const recentPayrolls = payrollRuns.filter(r => r.region === region).slice(0, 4);
  
  // Calculate upcoming payroll
  const today = new Date();
  const nextPayrollDate = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const daysLeft = Math.ceil((nextPayrollDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  const handleRunPayroll = async () => {
    const periodStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const periodEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    await createPayrollRun(periodStart, periodEnd);
  };

  const handleExport = () => {
    exportPayroll();
  };

  const taxRates = getTaxRates();

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
          <h1 className="text-3xl font-display font-bold text-foreground">Payroll</h1>
          <p className="text-muted-foreground mt-1">
            Manage payroll processing and compensation
          </p>
        </div>
        <div className="flex gap-3">
          <Select value={region} onValueChange={(v) => setRegion(v as "US" | "Nepal")}>
            <SelectTrigger className="w-[140px]">
              <Globe className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="US">🇺🇸 United States</SelectItem>
              <SelectItem value="Nepal">🇳🇵 Nepal</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" className="gap-2" onClick={handleExport}>
            <Download className="h-4 w-4" />
            Export
          </Button>
          {isVP && (
            <Button className="gap-2 shadow-md" onClick={handleRunPayroll}>
              <Calculator className="h-4 w-4" />
              Run Payroll
            </Button>
          )}
        </div>
      </div>

      {/* Tabs for Employee vs Attendance vs Contractor */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "overview" | "attendance" | "contractor")} className="mb-6">
        <TabsList>
          <TabsTrigger value="overview">Payroll Overview</TabsTrigger>
          <TabsTrigger value="attendance">Employee Attendance</TabsTrigger>
          <TabsTrigger value="contractor">Contractor Portal</TabsTrigger>
        </TabsList>
      </Tabs>

      {activeTab === "overview" ? (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card className="animate-slide-up opacity-0" style={{ animationDelay: "100ms", animationFillMode: "forwards" }}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Monthly Payroll</p>
                    <p className="text-2xl font-display font-bold mt-1">
                      {region === "US" ? "$" : "₨"}{(displayPayrollData[displayPayrollData.length - 1]?.amount || 0).toLocaleString()}
                    </p>
                    <p className="text-xs text-success mt-1">+3.0% from last month</p>
                  </div>
                  <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <DollarSign className="h-6 w-6 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="animate-slide-up opacity-0" style={{ animationDelay: "150ms", animationFillMode: "forwards" }}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Employees</p>
                    <p className="text-2xl font-display font-bold mt-1">{totalEmployees}</p>
                    <p className="text-xs text-muted-foreground mt-1">{region} region</p>
                  </div>
                  <div className="h-12 w-12 rounded-xl bg-info/10 flex items-center justify-center">
                    <Users className="h-6 w-6 text-info" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="animate-slide-up opacity-0" style={{ animationDelay: "200ms", animationFillMode: "forwards" }}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Avg. Salary</p>
                    <p className="text-2xl font-display font-bold mt-1">
                      {region === "US" ? "$" : "₨"}{avgSalary.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </p>
                    <p className="text-xs text-success mt-1">+2.5% YoY growth</p>
                  </div>
                  <div className="h-12 w-12 rounded-xl bg-success/10 flex items-center justify-center">
                    <TrendingUp className="h-6 w-6 text-success" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="animate-slide-up opacity-0" style={{ animationDelay: "250ms", animationFillMode: "forwards" }}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Next Payroll</p>
                    <p className="text-2xl font-display font-bold mt-1">{daysLeft} days</p>
                    <p className="text-xs text-muted-foreground mt-1">{format(nextPayrollDate, "MMM d, yyyy")}</p>
                  </div>
                  <div className="h-12 w-12 rounded-xl bg-warning/10 flex items-center justify-center">
                    <Calendar className="h-6 w-6 text-warning" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Payroll Trend Chart */}
            <Card className="lg:col-span-2 animate-slide-up opacity-0" style={{ animationDelay: "300ms", animationFillMode: "forwards" }}>
              <CardHeader>
                <CardTitle className="font-display text-lg flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Payroll Trend ({region})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={displayPayrollData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                      <YAxis
                        tick={{ fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => region === "US" ? `$${value / 1000}k` : `₨${value / 1000}k`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                        formatter={(value: number) => [`${region === "US" ? "$" : "₨"}${value.toLocaleString()}`, "Payroll"]}
                      />
                      <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                        {displayPayrollData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={index === displayPayrollData.length - 1 ? "hsl(192, 82%, 28%)" : "hsl(192, 82%, 28%, 0.5)"}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Tax Rates by Region */}
            <Card className="animate-slide-up opacity-0" style={{ animationDelay: "350ms", animationFillMode: "forwards" }}>
              <CardHeader>
                <CardTitle className="font-display text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Tax Rates ({region})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {region === "US" ? (
                  <>
                    <div className="flex justify-between items-center p-3 rounded-lg bg-secondary/50">
                      <span className="text-sm">Federal Tax</span>
                      <span className="font-semibold">{(taxRates.federal * 100).toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between items-center p-3 rounded-lg bg-secondary/50">
                      <span className="text-sm">State Tax</span>
                      <span className="font-semibold">{(taxRates.state * 100).toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between items-center p-3 rounded-lg bg-secondary/50">
                      <span className="text-sm">FICA</span>
                      <span className="font-semibold">{(taxRates.fica * 100).toFixed(2)}%</span>
                    </div>
                    <div className="flex justify-between items-center p-3 rounded-lg bg-secondary/50">
                      <span className="text-sm">Medicare</span>
                      <span className="font-semibold">{(taxRates.medicare * 100).toFixed(2)}%</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between items-center p-3 rounded-lg bg-secondary/50">
                      <span className="text-sm">Income Tax</span>
                      <span className="font-semibold">{((taxRates as any).incomeTax * 100).toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between items-center p-3 rounded-lg bg-secondary/50">
                      <span className="text-sm">Social Security</span>
                      <span className="font-semibold">{((taxRates as any).socialSecurity * 100).toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between items-center p-3 rounded-lg bg-secondary/50">
                      <span className="text-sm">Provident Fund</span>
                      <span className="font-semibold">{((taxRates as any).providentFund * 100).toFixed(1)}%</span>
                    </div>
                  </>
                )}

                <div className="pt-4 border-t border-border">
                  <p className="text-sm font-medium text-muted-foreground mb-3">Quick Actions</p>
                  <Button variant="outline" className="w-full justify-start gap-2 mb-2">
                    <FileText className="h-4 w-4" />
                    Preview Payslips
                  </Button>
                  <Button variant="outline" className="w-full justify-start gap-2">
                    <Calculator className="h-4 w-4" />
                    Run Calculations
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Payrolls Table */}
          <Card className="mt-6 animate-slide-up opacity-0" style={{ animationDelay: "400ms", animationFillMode: "forwards" }}>
            <CardHeader>
              <CardTitle className="font-display text-lg">Recent Payroll Runs</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Pay Period</TableHead>
                    <TableHead>Employees</TableHead>
                    <TableHead>Gross Pay</TableHead>
                    <TableHead>Net Pay</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Processed</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentPayrolls.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No payroll runs found for {region}
                      </TableCell>
                    </TableRow>
                  ) : (
                    recentPayrolls.map((payroll, index) => (
                      <TableRow key={payroll.id} className="animate-fade-in" style={{ animationDelay: `${500 + index * 50}ms` }}>
                        <TableCell className="font-medium">
                          {format(new Date(payroll.period_start), "MMM d")} - {format(new Date(payroll.period_end), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell>{payroll.employee_count || "-"}</TableCell>
                        <TableCell>{region === "US" ? "$" : "₨"}{(payroll.total_gross || 0).toLocaleString()}</TableCell>
                        <TableCell>{region === "US" ? "$" : "₨"}{(payroll.total_net || 0).toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn(
                            payroll.status === "completed" && "border-success text-success bg-success/10",
                            payroll.status === "processing" && "border-warning text-warning bg-warning/10",
                            payroll.status === "draft" && "border-muted-foreground"
                          )}>
                            {payroll.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {payroll.processed_at ? format(new Date(payroll.processed_at), "MMM d") : "-"}
                        </TableCell>
                        <TableCell>
                          {isVP && payroll.status === "draft" && (
                            <Button size="sm" onClick={() => processPayroll(payroll.id)}>
                              Process
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      ) : activeTab === "attendance" ? (
        /* Employee Attendance Tab */
        <Card className="animate-slide-up opacity-0" style={{ animationDelay: "100ms", animationFillMode: "forwards" }}>
          <CardHeader>
            <CardTitle className="font-display text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Employee Attendance - {format(new Date(), "MMMM yyyy")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {attendanceLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : teamAttendance.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium mb-2">No Attendance Data</p>
                <p className="text-sm">No attendance records found for this month.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Employee</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="text-right">Days Worked</TableHead>
                    <TableHead className="text-right">Total Hours</TableHead>
                    <TableHead className="text-right">Avg Hours/Day</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamAttendance.map((attendance, index) => (
                    <TableRow key={attendance.user_id} className="animate-fade-in" style={{ animationDelay: `${200 + index * 50}ms` }}>
                      <TableCell className="font-medium">{attendance.employee_name}</TableCell>
                      <TableCell className="text-muted-foreground">{attendance.email}</TableCell>
                      <TableCell className="text-right">{attendance.days_worked}</TableCell>
                      <TableCell className="text-right font-semibold">{attendance.total_hours}h</TableCell>
                      <TableCell className="text-right">
                        {attendance.days_worked > 0 
                          ? `${(attendance.total_hours / attendance.days_worked).toFixed(1)}h` 
                          : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            
            {/* Summary */}
            {teamAttendance.length > 0 && (
              <div className="flex items-center justify-between mt-6 pt-6 border-t border-border">
                <div className="text-center">
                  <p className="text-2xl font-display font-bold">{teamAttendance.length}</p>
                  <p className="text-sm text-muted-foreground">Employees</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-display font-bold">
                    {teamAttendance.reduce((sum, a) => sum + a.days_worked, 0)}
                  </p>
                  <p className="text-sm text-muted-foreground">Total Days</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-display font-bold">
                    {teamAttendance.reduce((sum, a) => sum + a.total_hours, 0).toFixed(1)}h
                  </p>
                  <p className="text-sm text-muted-foreground">Total Hours</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        /* Contractor Portal */
        <Card className="animate-slide-up opacity-0" style={{ animationDelay: "100ms", animationFillMode: "forwards" }}>
          <CardHeader>
            <CardTitle className="font-display text-lg">Contractor Portal</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">Contractor Management</p>
              <p className="text-sm">View and manage contractor invoices and payments</p>
              <Button className="mt-4" variant="outline">
                <FileText className="h-4 w-4 mr-2" />
                Submit Invoice
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </DashboardLayout>
  );
};

export default Payroll;
