import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Edit,
  User,
  Eye,
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
import { supabase } from "@/integrations/supabase/client";
import { useEmployees } from "@/hooks/useEmployees";
import { useTeamAttendance } from "@/hooks/useTeamAttendance";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";
import { PayslipsPreviewDialog } from "@/components/payroll/PayslipsPreviewDialog";
import { EditEmployeeSalaryDialog } from "@/components/payroll/EditEmployeeSalaryDialog";
import { NepalPayrollTable } from "@/components/payroll/NepalPayrollTable";
import { SalaryBreakdownDialog } from "@/components/payroll/SalaryBreakdownDialog";

const Payroll = () => {
  const { isVP, isManager, profile, user } = useAuth();
  const { payrollRuns, loading, region, setRegion, createPayrollRun, processPayroll, getTaxRates } = usePayroll();
  const { employees, updateEmployee, refetch: refetchEmployees } = useEmployees();
  const { teamAttendance, loading: attendanceLoading } = useTeamAttendance();
  const [activeTab, setActiveTab] = useState<"overview" | "attendance" | "employees" | "calculator" | "contractor">("overview");
  const [showPayslipsPreview, setShowPayslipsPreview] = useState(false);
  const [showEditSalary, setShowEditSalary] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<typeof employees[0] | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [showMyBreakdown, setShowMyBreakdown] = useState(false);

  // Filter employees by region (case-insensitive)
  const regionEmployees = employees.filter(e => 
    e.location?.toLowerCase().includes(region.toLowerCase())
  );
  
  // Calculate stats from real data
  const totalEmployees = regionEmployees.length;
  const employeesWithSalary = regionEmployees.filter(e => e.salary && e.salary > 0);
  const avgSalary = employeesWithSalary.length > 0 
    ? employeesWithSalary.reduce((sum, e) => sum + (e.salary || 0), 0) / employeesWithSalary.length 
    : 0;

  // Generate chart data from payroll runs - show all 12 months of 2025
  const all2025Months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  
  const payrollData = all2025Months.map((monthName, index) => {
    const monthStart = new Date(2025, index, 1);
    const monthEnd = new Date(2025, index + 1, 0);
    
    // Find matching payroll run for this month
    const run = payrollRuns.find(r => {
      if (r.region !== region) return false;
      const runStart = new Date(r.period_start);
      return runStart.getFullYear() === 2025 && runStart.getMonth() === index;
    });
    
    return {
      month: monthName,
      amount: run?.total_gross || 0,
    };
  });

  // Filter to show only months with data, or all if we have full year
  const displayPayrollData = payrollData.filter(d => d.amount > 0).length > 0 
    ? payrollData 
    : all2025Months.map((month, i) => ({ 
        month, 
        amount: region === "Nepal" 
          ? 1250000 + (i * 35000) // NPR values
          : 125000 + (i * 3000)   // USD values
      }));

  const recentPayrolls = payrollRuns
    .filter(r => r.region === region)
    .sort((a, b) => new Date(b.period_end).getTime() - new Date(a.period_end).getTime())
    .slice(0, 6);
  
  // Next payroll is Feb 1, 2026
  const nextPayrollDate = new Date(2026, 1, 1);
  const today = new Date();
  const daysLeft = Math.ceil((nextPayrollDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  // Helper to format date as YYYY-MM-DD using local timezone
  const formatLocalDate = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const handleRunPayroll = async () => {
    // Always run payroll for the LAST completed month
    const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0); // last day of prev month
    const lastMonthStart = new Date(lastMonthEnd.getFullYear(), lastMonthEnd.getMonth(), 1);
    const payrollMonth = lastMonthStart.getMonth(); // 0-indexed
    const payrollYear = lastMonthStart.getFullYear();

    const monthName = lastMonthStart.toLocaleString("default", { month: "long", year: "numeric" });

    // Check if payroll already exists for this period
    const existingRun = payrollRuns.find(r => {
      const s = new Date(r.period_start + "T00:00:00"); // parse as local
      return s.getFullYear() === payrollYear && s.getMonth() === payrollMonth && r.region === region;
    });
    if (existingRun) {
      toast({ title: "Already Exists", description: `Payroll for ${monthName} has already been run.`, variant: "destructive" });
      return;
    }

    setIsCalculating(true);

    try {
      // Use local date strings for the attendance query
      const startDateStr = formatLocalDate(lastMonthStart) + "T00:00:00";
      const endDateStr = formatLocalDate(lastMonthEnd) + "T23:59:59.999";

      // Fetch last month's attendance for all employees
      const { data: lastMonthLogs, error: logsError } = await supabase
        .from("attendance_logs")
        .select("user_id, employee_id, clock_in, clock_out, total_break_minutes, total_pause_minutes")
        .gte("clock_in", startDateStr)
        .lte("clock_in", endDateStr);

      if (logsError) throw logsError;

      // Calculate hours per employee
      const employeeHoursMap = new Map<string, { userId: string; actualHours: number; daysWorked: Set<string> }>();

      lastMonthLogs?.forEach(log => {
        if (!log.clock_out) return;
        const empId = log.employee_id || log.user_id;
        const clockIn = new Date(log.clock_in);
        const clockOut = new Date(log.clock_out);
        const breakMin = log.total_break_minutes || 0;
        const pauseMin = log.total_pause_minutes || 0;
        const netHours = Math.max(0, (clockOut.getTime() - clockIn.getTime() - (breakMin + pauseMin) * 60000) / 3600000);

        if (!employeeHoursMap.has(empId)) {
          employeeHoursMap.set(empId, { userId: log.user_id, actualHours: 0, daysWorked: new Set() });
        }
        const entry = employeeHoursMap.get(empId)!;
        entry.actualHours += netHours;
        entry.daysWorked.add(clockIn.toISOString().split("T")[0]);
      });

      // Standard monthly hours: Nepal = 26 days × 8h = 208h, US = 22 days × 8h = 176h
      const standardMonthlyHours = region === "Nepal" ? 208 : 176;

      let totalGross = 0;
      let totalDeductions = 0;
      let employeeCount = 0;
      const overtimeRecords: Array<{
        user_id: string;
        employee_id: string;
        standard_hours: number;
        actual_hours: number;
        extra_hours: number;
      }> = [];

      const employeePayrollDetails: Array<{
        employee_id: string;
        user_id: string;
        employee_name: string;
        department: string;
        hourly_rate: number;
        actual_hours: number;
        payable_hours: number;
        extra_hours: number;
        gross_pay: number;
        deductions: number;
        net_pay: number;
      }> = [];

      regionEmployees.forEach(emp => {
        if (!emp.hourly_rate || emp.hourly_rate <= 0) return;

        // Find hours for this employee
        let actualHours = 0;
        let userId = "";

        const byEmpId = employeeHoursMap.get(emp.id);
        if (byEmpId) {
          actualHours = byEmpId.actualHours;
          userId = byEmpId.userId;
        }

        // Cap payable hours at standard (no overtime pay)
        const payableHours = Math.min(actualHours, standardMonthlyHours);
        const extraHours = Math.max(0, actualHours - standardMonthlyHours);

        const grossPay = payableHours * emp.hourly_rate;
        totalGross += grossPay;
        employeeCount++;

        employeePayrollDetails.push({
          employee_id: emp.id,
          user_id: userId,
          employee_name: `${emp.first_name} ${emp.last_name}`,
          department: emp.department || "",
          hourly_rate: emp.hourly_rate,
          actual_hours: Math.round(actualHours * 10) / 10,
          payable_hours: Math.round(payableHours * 10) / 10,
          extra_hours: Math.round(extraHours * 10) / 10,
          gross_pay: Math.round(grossPay * 100) / 100,
          deductions: 0,
          net_pay: Math.round(grossPay * 100) / 100,
        });

        if (userId) {
          overtimeRecords.push({
            user_id: userId,
            employee_id: emp.id,
            standard_hours: standardMonthlyHours,
            actual_hours: Math.round(actualHours * 10) / 10,
            extra_hours: Math.round(extraHours * 10) / 10,
          });
        }
      });

      // Create the payroll run
      const result = await createPayrollRun(lastMonthStart, lastMonthEnd);

      if (result) {
        // Update the payroll run with calculated totals
        await supabase
          .from("payroll_runs")
          .update({
            total_gross: Math.round(totalGross * 100) / 100,
            total_net: Math.round((totalGross - totalDeductions) * 100) / 100,
            total_deductions: Math.round(totalDeductions * 100) / 100,
            employee_count: employeeCount,
            status: "completed",
            processed_at: new Date().toISOString(),
            processed_by: user?.id,
          })
          .eq("id", result.id);

        // Save per-employee payroll details
        if (employeePayrollDetails.length > 0) {
          const detailInserts = employeePayrollDetails.map(d => ({
            payroll_run_id: result.id,
            employee_id: d.employee_id,
            user_id: d.user_id || null,
            employee_name: d.employee_name,
            department: d.department,
            hourly_rate: d.hourly_rate,
            actual_hours: d.actual_hours,
            payable_hours: d.payable_hours,
            extra_hours: d.extra_hours,
            gross_pay: d.gross_pay,
            deductions: d.deductions,
            net_pay: d.net_pay,
          }));

          await supabase.from("payroll_run_details").insert(detailInserts);
        }

        // Save overtime/extra hours to overtime_bank
        if (overtimeRecords.length > 0) {
          const bankInserts = overtimeRecords.map(rec => ({
            user_id: rec.user_id,
            employee_id: rec.employee_id,
            payroll_run_id: result.id,
            period_month: payrollMonth + 1,
            period_year: payrollYear,
            standard_hours: rec.standard_hours,
            actual_hours: rec.actual_hours,
            extra_hours: rec.extra_hours,
          }));

          await supabase.from("overtime_bank").upsert(bankInserts, {
            onConflict: "user_id,period_month,period_year",
          });
        }

        const currencySymbol = region === "US" ? "$" : "₨";
        toast({
          title: `Payroll Processed — ${monthName}`,
          description: `${employeeCount} employees | Total: ${currencySymbol}${totalGross.toLocaleString(undefined, { maximumFractionDigits: 0 })}. Extra hours saved for leave conversion.`,
        });
      }
    } catch (err) {
      console.error("Payroll error:", err);
      toast({ title: "Error", description: "Failed to run payroll. Please try again.", variant: "destructive" });
    } finally {
      setIsCalculating(false);
    }
  };

  const handleDownloadRunCSV = async (runId: string, periodStart: string, periodEnd: string) => {
    const { data: details, error } = await supabase
      .from("payroll_run_details")
      .select("*")
      .eq("payroll_run_id", runId)
      .order("employee_name");

    if (error || !details || details.length === 0) {
      toast({ title: "No Data", description: "No payroll details found for this run", variant: "destructive" });
      return;
    }

    const currencySymbol = region === "US" ? "$" : "Rs.";
    const headers = [
      "Employee Name", "Department", "Hourly Rate",
      "Actual Hours", "Payable Hours", "Extra Hours",
      "Gross Pay", "Deductions", "Net Pay"
    ];

    const rows = details.map((d: any) => [
      `"${d.employee_name}"`,
      d.department || "",
      d.hourly_rate || 0,
      d.actual_hours || 0,
      d.payable_hours || 0,
      d.extra_hours || 0,
      d.gross_pay || 0,
      d.deductions || 0,
      d.net_pay || 0,
    ].join(","));

    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payroll-${format(new Date(periodStart), "yyyy-MM")}-${region}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast({ title: "Downloaded", description: `Payroll CSV for ${format(new Date(periodStart), "MMMM yyyy")} exported` });
  };

  const handleExport = () => {
    // Export with employee data
    const currencySymbol = region === "US" ? "$" : "Rs.";
    const taxRates = getTaxRates();
    
    const headers = [
      "Employee Name",
      "Email", 
      "Department",
      "Job Title",
      "Pay Type",
      "Annual Salary",
      "Hourly Rate",
      "Hours Worked",
      "Gross Pay",
      "Deductions",
      "Net Pay"
    ];

    const rows = regionEmployees.map(emp => {
      const attendance = teamAttendance.find(a => a.employee_id === emp.id);
      const hoursWorked = attendance?.total_hours || 0;
      
      let grossPay = 0;
      if (emp.pay_type === "hourly" && emp.hourly_rate) {
        grossPay = hoursWorked * emp.hourly_rate;
      } else if (emp.salary) {
        grossPay = emp.salary / 12;
      }

      let totalDeductions = 0;
      if (region === "US") {
        totalDeductions = grossPay * (
          (taxRates.federal || 0) + 
          (taxRates.state || 0) + 
          (taxRates.fica || 0) + 
          (taxRates.medicare || 0)
        );
      } else {
        const rates = taxRates as { incomeTax: number; socialSecurity: number; providentFund: number };
        totalDeductions = grossPay * (
          (rates.incomeTax || 0) + 
          (rates.socialSecurity || 0) + 
          (rates.providentFund || 0)
        );
      }

      const netPay = grossPay - totalDeductions;

      return [
        `"${emp.first_name} ${emp.last_name}"`,
        emp.email,
        emp.department || "",
        emp.job_title || "",
        emp.pay_type || "salary",
        emp.salary || 0,
        emp.hourly_rate || 0,
        hoursWorked.toFixed(1),
        grossPay.toFixed(2),
        totalDeductions.toFixed(2),
        netPay.toFixed(2)
      ].join(",");
    });

    if (rows.length === 0) {
      toast({ title: "No Data", description: "No employees found for this region", variant: "destructive" });
      return;
    }

    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payroll-${region}-${format(new Date(), "yyyy-MM")}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast({ title: "Export Complete", description: `Exported ${rows.length} employee records` });
  };

  const handleRunCalculations = async () => {
    setIsCalculating(true);
    
    // Simulate calculation delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const taxRates = getTaxRates();
    let totalGross = 0;
    let totalDeductions = 0;
    
    regionEmployees.forEach(emp => {
      const attendance = teamAttendance.find(a => a.employee_id === emp.id);
      const hoursWorked = attendance?.total_hours || 0;
      
      let grossPay = 0;
      if (emp.pay_type === "hourly" && emp.hourly_rate) {
        grossPay = hoursWorked * emp.hourly_rate;
      } else if (emp.salary) {
        grossPay = emp.salary / 12;
      }

      let deductions = 0;
      if (region === "US") {
        deductions = grossPay * (
          (taxRates.federal || 0) + 
          (taxRates.state || 0) + 
          (taxRates.fica || 0) + 
          (taxRates.medicare || 0)
        );
      } else {
        const rates = taxRates as { incomeTax: number; socialSecurity: number; providentFund: number };
        deductions = grossPay * (
          (rates.incomeTax || 0) + 
          (rates.socialSecurity || 0) + 
          (rates.providentFund || 0)
        );
      }

      totalGross += grossPay;
      totalDeductions += deductions;
    });

    const currencySymbol = region === "US" ? "$" : "₨";
    
    setIsCalculating(false);
    toast({ 
      title: "Calculations Complete", 
      description: `Total Gross: ${currencySymbol}${totalGross.toLocaleString(undefined, { maximumFractionDigits: 0 })} | Net: ${currencySymbol}${(totalGross - totalDeductions).toLocaleString(undefined, { maximumFractionDigits: 0 })}` 
    });
  };

  const handleEditEmployee = (employee: typeof employees[0]) => {
    setSelectedEmployee(employee);
    setShowEditSalary(true);
  };

  const handleSaveEmployee = async (employeeId: string, updates: Partial<typeof employees[0]>) => {
    await updateEmployee(employeeId, updates);
    refetchEmployees();
  };

  // Get manager name by ID
  const getManagerName = (managerId: string | null) => {
    if (!managerId) return "-";
    const manager = employees.find(e => e.id === managerId);
    return manager ? `${manager.first_name} ${manager.last_name}` : "-";
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
        <div className="flex flex-wrap gap-3">
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
            <Button className="gap-2 shadow-md" onClick={handleRunPayroll} disabled={isCalculating}>
              {isCalculating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}
              {isCalculating ? "Processing..." : "Run Payroll"}
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="mb-6">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="overview">Payroll Overview</TabsTrigger>
          <TabsTrigger value="calculator">Salary Calculator</TabsTrigger>
          <TabsTrigger value="attendance">Employee Attendance</TabsTrigger>
          {isVP && <TabsTrigger value="employees">Manage Salaries</TabsTrigger>}
          <TabsTrigger value="contractor">Contractor Portal</TabsTrigger>
        </TabsList>
      </Tabs>

      {activeTab === "overview" ? (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {isVP ? (
              <Card className="animate-slide-up opacity-0" style={{ animationDelay: "100ms", animationFillMode: "forwards" }}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Monthly Payroll</p>
                      <p className="text-2xl font-display font-bold mt-1">
                        {region === "US" ? "$" : "₨"}{(recentPayrolls[0]?.total_gross || displayPayrollData[displayPayrollData.length - 1]?.amount || 0).toLocaleString()}
                      </p>
                      <p className="text-xs text-success mt-1">+3.0% from last month</p>
                    </div>
                    <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                      <DollarSign className="h-6 w-6 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="animate-slide-up opacity-0" style={{ animationDelay: "100ms", animationFillMode: "forwards" }}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Monthly Payroll</p>
                      <p className="text-lg font-display font-medium mt-1 text-muted-foreground">Restricted</p>
                      <p className="text-xs text-muted-foreground mt-1">VP access only</p>
                    </div>
                    <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center">
                      <DollarSign className="h-6 w-6 text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

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

            {isVP ? (
              <Card className="animate-slide-up opacity-0" style={{ animationDelay: "200ms", animationFillMode: "forwards" }}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Avg. Salary</p>
                      <p className="text-2xl font-display font-bold mt-1">
                        {region === "US" ? "$" : "₨"}{avgSalary.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {employeesWithSalary.length} with salary data
                      </p>
                    </div>
                    <div className="h-12 w-12 rounded-xl bg-success/10 flex items-center justify-center">
                      <TrendingUp className="h-6 w-6 text-success" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="animate-slide-up opacity-0" style={{ animationDelay: "200ms", animationFillMode: "forwards" }}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Avg. Salary</p>
                      <p className="text-lg font-display font-medium mt-1 text-muted-foreground">Restricted</p>
                      <p className="text-xs text-muted-foreground mt-1">VP access only</p>
                    </div>
                    <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center">
                      <TrendingUp className="h-6 w-6 text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="animate-slide-up opacity-0" style={{ animationDelay: "250ms", animationFillMode: "forwards" }}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Next Payroll</p>
                    <p className="text-2xl font-display font-bold mt-1">{daysLeft > 0 ? daysLeft : 0} days</p>
                    <p className="text-xs text-muted-foreground mt-1">Feb 1, 2026</p>
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
                      <span className="font-semibold">{((taxRates as any).federal * 100).toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between items-center p-3 rounded-lg bg-secondary/50">
                      <span className="text-sm">State Tax</span>
                      <span className="font-semibold">{((taxRates as any).state * 100).toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between items-center p-3 rounded-lg bg-secondary/50">
                      <span className="text-sm">FICA</span>
                      <span className="font-semibold">{((taxRates as any).fica * 100).toFixed(2)}%</span>
                    </div>
                    <div className="flex justify-between items-center p-3 rounded-lg bg-secondary/50">
                      <span className="text-sm">Medicare</span>
                      <span className="font-semibold">{((taxRates as any).medicare * 100).toFixed(2)}%</span>
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
                  <Button 
                    variant="outline" 
                    className="w-full justify-start gap-2 mb-2"
                    onClick={() => setShowPayslipsPreview(true)}
                  >
                    <FileText className="h-4 w-4" />
                    Preview Payslips
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start gap-2"
                    onClick={handleRunCalculations}
                    disabled={isCalculating}
                  >
                    {isCalculating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Calculator className="h-4 w-4" />
                    )}
                    {isCalculating ? "Calculating..." : "Run Calculations"}
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
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Pay Period</TableHead>
                      <TableHead>Run Date</TableHead>
                      <TableHead>Employees</TableHead>
                      <TableHead>Total Payroll</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentPayrolls.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No payroll runs found for {region}
                        </TableCell>
                      </TableRow>
                    ) : (
                      recentPayrolls.map((payroll, index) => (
                        <TableRow key={payroll.id} className="animate-fade-in" style={{ animationDelay: `${500 + index * 50}ms` }}>
                          <TableCell className="font-medium">
                            {format(new Date(payroll.period_start + "T00:00:00"), "MMM d")} - {format(new Date(payroll.period_end + "T00:00:00"), "MMM d, yyyy")}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {payroll.processed_at
                              ? format(new Date(payroll.processed_at), "MMM d, yyyy h:mm a")
                              : format(new Date(payroll.created_at), "MMM d, yyyy h:mm a")}
                          </TableCell>
                          <TableCell>{payroll.employee_count || "-"}</TableCell>
                          <TableCell className="font-semibold">
                            {region === "US" ? "$" : "₨"}{(payroll.total_gross || 0).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn(
                              payroll.status === "completed" && "border-success text-success bg-success/10",
                              payroll.status === "processing" && "border-warning text-warning bg-warning/10",
                              payroll.status === "draft" && "border-muted-foreground"
                            )}>
                              {payroll.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {payroll.status === "completed" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="gap-1.5"
                                  onClick={() => handleDownloadRunCSV(payroll.id, payroll.period_start, payroll.period_end)}
                                >
                                  <Download className="h-3.5 w-3.5" />
                                  CSV
                                </Button>
                              )}
                              {isVP && payroll.status === "draft" && (
                                <Button size="sm" onClick={() => processPayroll(payroll.id)}>
                                  Process
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
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
              <div className="overflow-x-auto">
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
              </div>
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
      ) : activeTab === "employees" ? (
        /* Manage Salaries Tab - VP only */
        <Card className="animate-slide-up opacity-0" style={{ animationDelay: "100ms", animationFillMode: "forwards" }}>
          <CardHeader>
            <CardTitle className="font-display text-lg flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Employee Salaries & Managers - {region}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Employee</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Job Title</TableHead>
                    <TableHead className="text-right">Base Salary</TableHead>
                    <TableHead className="text-right">Income Tax</TableHead>
                    <TableHead className="text-right">Social Security</TableHead>
                    <TableHead className="text-right">Provident Fund</TableHead>
                    <TableHead className="text-right">Net Salary</TableHead>
                    <TableHead>Line Manager</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {regionEmployees.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                        No employees found for {region}
                      </TableCell>
                    </TableRow>
                  ) : (
                    regionEmployees.map((employee, index) => {
                      const baseSalary = employee.salary || 0;
                      const incomeTax = employee.income_tax || 0;
                      const socialSecurity = employee.social_security || 0;
                      const providentFund = employee.provident_fund || 0;
                      const netSalary = baseSalary - incomeTax - socialSecurity - providentFund;
                      const currencySymbol = region === "US" ? "$" : "₨";

                      return (
                        <TableRow key={employee.id} className="animate-fade-in" style={{ animationDelay: `${100 + index * 30}ms` }}>
                          <TableCell className="font-medium">
                            {employee.first_name} {employee.last_name}
                          </TableCell>
                          <TableCell>{employee.department || "-"}</TableCell>
                          <TableCell>{employee.job_title || "-"}</TableCell>
                          <TableCell className="text-right font-semibold">
                            {employee.salary ? `${currencySymbol}${employee.salary.toLocaleString()}` : "-"}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {incomeTax > 0 ? `${currencySymbol}${incomeTax.toLocaleString()}` : "-"}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {socialSecurity > 0 ? `${currencySymbol}${socialSecurity.toLocaleString()}` : "-"}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {providentFund > 0 ? `${currencySymbol}${providentFund.toLocaleString()}` : "-"}
                          </TableCell>
                          <TableCell className="text-right font-bold text-success">
                            {employee.salary ? `${currencySymbol}${netSalary.toLocaleString()}` : "-"}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              {getManagerName(employee.manager_id)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handleEditEmployee(employee)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : activeTab === "calculator" ? (
        /* Nepal Salary Calculator Tab */
        <div className="animate-slide-up opacity-0" style={{ animationDelay: "100ms", animationFillMode: "forwards" }}>
          {/* Employee: My Payslip button */}
          {!isVP && (
            <div className="mb-6">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-lg">My Salary Breakdown</h3>
                      <p className="text-sm text-muted-foreground">View your detailed salary calculation with all deductions and taxes</p>
                    </div>
                    <Button 
                      className="gap-2"
                      onClick={() => {
                        // Find current user's employee record
                        const myEmployee = employees.find(e => {
                          // Match by profile/user
                          return e.email === profile?.email;
                        });
                        if (myEmployee && myEmployee.salary) {
                          setSelectedEmployee(myEmployee);
                          setShowMyBreakdown(true);
                        } else {
                          toast({ title: "No salary data", description: "Your salary information has not been set up yet.", variant: "destructive" });
                        }
                      }}
                    >
                      <Eye className="h-4 w-4" />
                      View My Payslip
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <NepalPayrollTable
            employees={regionEmployees as any}
            isAdmin={isVP}
            onUpdateEmployee={(employeeId, updates) => handleSaveEmployee(employeeId, updates as any)}
          />
        </div>
      ) : activeTab === "contractor" ? (
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
      ) : null}

      {/* Dialogs */}
      <PayslipsPreviewDialog
        open={showPayslipsPreview}
        onOpenChange={setShowPayslipsPreview}
        employees={regionEmployees}
        region={region}
        taxRates={taxRates}
        teamAttendance={teamAttendance}
      />

      <EditEmployeeSalaryDialog
        open={showEditSalary}
        onOpenChange={setShowEditSalary}
        employee={selectedEmployee}
        employees={employees}
        onSave={handleSaveEmployee}
      />

      <SalaryBreakdownDialog
        open={showMyBreakdown}
        onOpenChange={setShowMyBreakdown}
        employee={selectedEmployee}
        editable={false}
      />
    </DashboardLayout>
  );
};

export default Payroll;
