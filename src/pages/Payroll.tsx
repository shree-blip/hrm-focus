import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
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
  FileDown,
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
import { RunPayrollDialog } from "@/components/payroll/RunPayrollDialog";
import { PayrollDataGrid, type PayrollRow } from "@/components/payroll/PayrollDataGrid";
import { PayrollExportPreviewDialog } from "@/components/payroll/PayrollExportPreviewDialog";
import { MyPayslipsTab } from "@/components/payroll/MyPayslipsTab";
import { exportPayrollCSV, mapDetailToExportRow } from "@/lib/payrollCsvExport";
import { calculateWorkingHours, calculateMonthlyWorkingHours, hourlyRateFromSalary, calculateDeductions, HOURS_PER_DAY } from "@/lib/payrollHours";
import { calculateEMI, FIXED_ANNUAL_RATE } from "@/lib/loanCalculations";
import { usePayslips } from "@/hooks/usePayslips";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import type { PayslipEmployeeData, PayslipRunContext } from "@/lib/payslipPdfGenerator";

const Payroll = () => {
  const { isVP, isManager, profile, user } = useAuth();
  const { payrollRuns, loading, region, setRegion, createPayrollRun, processPayroll, getTaxRates } = usePayroll();
  const { employees, updateEmployee, refetch: refetchEmployees } = useEmployees();
  const { teamAttendance, loading: attendanceLoading } = useTeamAttendance();
  const { generating: generatingPayslips, progress: payslipProgress, generateAndUploadPayslips, downloadPayslip, downloadAllAsZip, fetchRunPayslips, payslipRecords, checkPayslipsExist } = usePayslips();
  const { settings: companySettings } = useCompanySettings();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const validTabs = ["overview", "attendance", "employees", "calculator", "contractor", "my-payslips"] as const;
  type TabType = typeof validTabs[number];
  const adminTabs: TabType[] = ["overview", "attendance", "employees", "calculator", "contractor"];
  const tabParam = searchParams.get("tab") as TabType | null;
  const defaultTab: TabType = isVP ? "overview" : "my-payslips";
  // Non-VP users can only access "my-payslips"
  const resolvedTab: TabType = tabParam && validTabs.includes(tabParam)
    ? (!isVP && adminTabs.includes(tabParam) ? defaultTab : tabParam)
    : defaultTab;
  const activeTab: TabType = resolvedTab;

  const setActiveTab = (tab: TabType) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set("tab", tab);
      // Clear modal params when switching tabs
      next.delete("modal");
      next.delete("empId");
      return next;
    }, { replace: true });
  };

  const modalParam = searchParams.get("modal");
  const modalEmpId = searchParams.get("empId");

  const setModalParam = (modal: string | null, empId?: string) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (modal) {
        next.set("modal", modal);
        if (empId) next.set("empId", empId);
      } else {
        next.delete("modal");
        next.delete("empId");
      }
      return next;
    }, { replace: true });
  };

  const [selectedEmployee, setSelectedEmployee] = useState<typeof employees[0] | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [viewRunId, setViewRunId] = useState<string | null>(searchParams.get("runId"));
  const [viewRunRows, setViewRunRows] = useState<PayrollRow[]>([]);
  const [viewRunPeriod, setViewRunPeriod] = useState<{ start: string; end: string } | null>(null);
  const [activeLoansForPreview, setActiveLoansForPreview] = useState<any[]>([]);
  const [approvedLeavesForPreview, setApprovedLeavesForPreview] = useState<any[]>([]);

  // Derive modal open states from URL
  const showPayslipsPreview = modalParam === "payslips";
  const showEditSalary = modalParam === "editSalary";
  const showMyBreakdown = modalParam === "myBreakdown";
  const showRunPayrollDialog = modalParam === "runPayroll";
  const showExportPreview = modalParam === "exportPreview";

  // Restore selected employee from URL param on mount/change
  useEffect(() => {
    if (modalEmpId && employees.length > 0) {
      const emp = employees.find(e => e.id === modalEmpId);
      if (emp) setSelectedEmployee(emp);
    }
  }, [modalEmpId, employees]);

  // Fetch loans and leaves in parallel for export preview
  useEffect(() => {
    if (!isVP) return;
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const monthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()}`;

    Promise.all([
      supabase
        .from("loan_requests")
        .select("id, employee_id, amount, term_months, interest_rate, remaining_balance, estimated_monthly_installment, status, disbursed_at")
        .in("status", ["disbursed"]),
      supabase
        .from("leave_requests")
        .select("user_id, leave_type, start_date, end_date, days")
        .eq("status", "approved")
        .lte("start_date", monthEnd)
        .gte("end_date", monthStart),
    ]).then(([loansRes, leavesRes]) => {
      if (loansRes.data) setActiveLoansForPreview(loansRes.data);
      if (leavesRes.data) setApprovedLeavesForPreview(leavesRes.data);
    });
  }, [isVP]);

  // Filter employees by region (case-insensitive)
  const regionEmployees = employees.filter(e => 
    e.location?.toLowerCase().includes(region.toLowerCase())
  );

  // Fetch payslip records when viewing a payroll run detail
  useEffect(() => {
    if (viewRunId) {
      fetchRunPayslips(viewRunId);
    }
  }, [viewRunId, fetchRunPayslips]);
  
  // Calculate stats from real data
  const totalEmployees = regionEmployees.length;
  const employeesWithSalary = regionEmployees.filter(e => e.salary && e.salary > 0);
  const avgSalary = employeesWithSalary.length > 0 
    ? employeesWithSalary.reduce((sum, e) => sum + (e.salary || 0), 0) / employeesWithSalary.length 
    : 0;

  // Generate chart data from payroll runs - show all 12 months of the current year
  const chartYear = new Date().getFullYear();
  const allMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  
  const payrollData = allMonths.map((monthName, index) => {
    // Find matching payroll run for this month
    const run = payrollRuns.find(r => {
      if (r.region !== region) return false;
      const runStart = new Date(r.period_start);
      return runStart.getFullYear() === chartYear && runStart.getMonth() === index;
    });
    
    return {
      month: monthName,
      amount: run?.total_gross || 0,
    };
  });

  // Filter to show only months with data, or all if we have full year
  const displayPayrollData = payrollData.filter(d => d.amount > 0).length > 0 
    ? payrollData 
    : allMonths.map((month, i) => ({ 
        month, 
        amount: region === "Nepal" 
          ? 1250000 + (i * 35000) // NPR values
          : 125000 + (i * 3000)   // USD values
      }));

  const recentPayrolls = payrollRuns
    .filter(r => r.region === region)
    .sort((a, b) => new Date(b.period_end).getTime() - new Date(a.period_end).getTime())
    .slice(0, 6);
  
  // Next payroll: 1st of next month (or current month if today is before the 1st)
  const today = new Date();
  const nextPayrollDate = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const daysLeft = Math.ceil((nextPayrollDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  // Helper to format date as YYYY-MM-DD using local timezone
  const formatLocalDate = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const handleRunPayroll = async (periodStart: Date, periodEnd: Date) => {
    setIsCalculating(true);

    try {
      const startDateStr = formatLocalDate(periodStart) + "T00:00:00";
      const endDateStr = formatLocalDate(periodEnd) + "T23:59:59.999";

      // Calculate working days & required hours for the pay-period range
      // Uses 2 weekly offs (Sat + Sun) and 8 hrs/day for all regions
      const { workDays: workDaysInRange, requiredHours: standardHoursInRange } =
        calculateWorkingHours(periodStart, periodEnd);

      // Full-month working hours (for prorating monthly salary → hourly rate)
      const { requiredHours: standardMonthlyHours } =
        calculateMonthlyWorkingHours(periodStart);

      // Fetch attendance for the selected period
      const { data: periodLogs, error: logsError } = await supabase
        .from("attendance_logs")
        .select("user_id, employee_id, clock_in, clock_out, total_break_minutes, total_pause_minutes")
        .gte("clock_in", startDateStr)
        .lte("clock_in", endDateStr);

      if (logsError) throw logsError;

      // Build hours maps
      const hoursByEmployeeId = new Map<string, { userId: string; actualHours: number }>();
      const hoursByUserId = new Map<string, { actualHours: number }>();

      // Track unique attendance days per employee_id and user_id
      const daysByEmployeeId = new Map<string, Set<string>>();
      const daysByUserId = new Map<string, Set<string>>();

      periodLogs?.forEach(log => {
        if (!log.clock_out) return;
        const clockIn = new Date(log.clock_in);
        const clockOut = new Date(log.clock_out);
        const breakMin = log.total_break_minutes || 0;
        const pauseMin = log.total_pause_minutes || 0;
        const netHours = Math.max(0, (clockOut.getTime() - clockIn.getTime() - (breakMin + pauseMin) * 60000) / 3600000);

        // Extract calendar date from clock_in for day counting
        const dayKey = log.clock_in.substring(0, 10); // YYYY-MM-DD

        if (log.employee_id) {
          const existing = hoursByEmployeeId.get(log.employee_id);
          if (existing) {
            existing.actualHours += netHours;
          } else {
            hoursByEmployeeId.set(log.employee_id, { userId: log.user_id, actualHours: netHours });
          }

          const empDays = daysByEmployeeId.get(log.employee_id);
          if (empDays) {
            empDays.add(dayKey);
          } else {
            daysByEmployeeId.set(log.employee_id, new Set([dayKey]));
          }
        }

        const existingUser = hoursByUserId.get(log.user_id);
        if (existingUser) {
          existingUser.actualHours += netHours;
        } else {
          hoursByUserId.set(log.user_id, { actualHours: netHours });
        }

        const userDays = daysByUserId.get(log.user_id);
        if (userDays) {
          userDays.add(dayKey);
        } else {
          daysByUserId.set(log.user_id, new Set([dayKey]));
        }
      });

      // Fetch existing time bank balances for all employees
      const { data: timeBankData } = await supabase
        .from("overtime_bank")
        .select("user_id, employee_id, id, extra_hours, used_hours")
        .eq("converted_to_leave", false);

      // Build time bank map: employee_id -> available hours & record ids
      const timeBankByEmployee = new Map<string, { available: number; records: { id: string; available: number }[] }>();
      timeBankData?.forEach(rec => {
        const empId = rec.employee_id || "";
        const available = (rec.extra_hours || 0) - (rec.used_hours || 0);
        if (available <= 0) return;
        const existing = timeBankByEmployee.get(empId);
        if (existing) {
          existing.available += available;
          existing.records.push({ id: rec.id, available });
        } else {
          timeBankByEmployee.set(empId, { available, records: [{ id: rec.id, available }] });
        }
      });

      // Track time bank updates to apply after payroll
      const timeBankUpdates: { id: string; addUsedHours: number }[] = [];

      // ── Fetch active (disbursed) loans for EMI deduction ──
      const { data: activeLoans } = await supabase
        .from("loan_requests")
        .select("id, employee_id, user_id, amount, term_months, interest_rate, estimated_monthly_installment, status, created_at")
        .in("status", ["disbursed"]);

      // Build map: employee_id → array of active loans
      const loansByEmployee = new Map<string, Array<{
        id: string; emi: number; remainingBalance: number;
      }>>();
      activeLoans?.forEach(loan => {
        if (!loan.employee_id) return;
        const emi = loan.estimated_monthly_installment
          || calculateEMI(Number(loan.amount), loan.interest_rate ?? FIXED_ANNUAL_RATE, loan.term_months);
        const remaining = Number(loan.amount);
        if (remaining <= 0) return;
        const arr = loansByEmployee.get(loan.employee_id) || [];
        arr.push({ id: loan.id, emi: Math.round(emi * 100) / 100, remainingBalance: remaining });
        loansByEmployee.set(loan.employee_id, arr);
      });

      // Track EMI deductions to record via RPC after payroll run is created
      const emiDeductions: Array<{ loanId: string; amount: number }> = [];

      // ── Fetch approved leaves that overlap with the pay period ──
      const { data: approvedLeaves } = await supabase
        .from("leave_requests")
        .select("user_id, leave_type, start_date, end_date, days")
        .eq("status", "approved")
        .lte("start_date", formatLocalDate(periodEnd))
        .gte("end_date", formatLocalDate(periodStart));

      // Helper: count working days (Mon-Fri) within a date range
      const countWorkDaysInRange = (start: Date, end: Date): number => {
        let count = 0;
        const d = new Date(start);
        d.setHours(0, 0, 0, 0);
        const e = new Date(end);
        e.setHours(0, 0, 0, 0);
        while (d <= e) {
          const dow = d.getDay();
          if (dow !== 0 && dow !== 6) count++;
          d.setDate(d.getDate() + 1);
        }
        return count;
      };

      // Build map: user_id → { paidLeaveDays, unpaidLeaveDays }
      const UNPAID_LEAVE_TYPES = ["Other Leave"];
      const leaveByUserId = new Map<string, { paidLeaveDays: number; unpaidLeaveDays: number }>();
      approvedLeaves?.forEach(leave => {
        // Calculate overlapping working days between leave and pay period
        const ls = new Date(leave.start_date + "T00:00:00");
        const le = new Date(leave.end_date + "T00:00:00");
        const overlapStart = ls > periodStart ? ls : periodStart;
        const overlapEnd = le < periodEnd ? le : periodEnd;
        if (overlapStart > overlapEnd) return;
        const overlapDays = countWorkDaysInRange(overlapStart, overlapEnd);
        if (overlapDays <= 0) return;

        const existing = leaveByUserId.get(leave.user_id) || { paidLeaveDays: 0, unpaidLeaveDays: 0 };
        if (UNPAID_LEAVE_TYPES.includes(leave.leave_type)) {
          existing.unpaidLeaveDays += overlapDays;
        } else {
          existing.paidLeaveDays += overlapDays;
        }
        leaveByUserId.set(leave.user_id, existing);
      });

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
        days_worked: number;
        actual_hours: number;
        payable_hours: number;
        extra_hours: number;
        bank_hours_used: number;
        paid_leave_days: number;
        unpaid_leave_days: number;
        gross_pay: number;
        income_tax: number;
        social_security: number;
        provident_fund: number;
        loan_emi: number;
        deductions: number;
        net_pay: number;
      }> = [];

      regionEmployees.forEach(emp => {
        const hasHourlyRate = emp.hourly_rate && emp.hourly_rate > 0;
        const hasSalary = emp.salary && emp.salary > 0;
        if (!hasHourlyRate && !hasSalary) return;

        let actualHours = 0;
        let userId = (emp as any).user_id || "";

        const byEmpId = hoursByEmployeeId.get(emp.id);
        if (byEmpId) {
          actualHours = byEmpId.actualHours;
          userId = byEmpId.userId;
        } else if (userId) {
          const byUserId = hoursByUserId.get(userId);
          if (byUserId) {
            actualHours = byUserId.actualHours;
          }
        }

        // Count unique attendance days for this employee
        const daysWorked = (daysByEmployeeId.get(emp.id)?.size || 0)
          || (userId ? (daysByUserId.get(userId)?.size || 0) : 0);

        let grossPay = 0;
        let hourlyRate = 0;
        let bankHoursUsed = 0;

        if (hasHourlyRate) {
          hourlyRate = emp.hourly_rate!;
        } else if (hasSalary) {
          hourlyRate = hourlyRateFromSalary(emp.salary!, standardMonthlyHours);
        }

        // ── Leave adjustment ──
        const empLeave = userId ? leaveByUserId.get(userId) : undefined;
        const paidLeaveDays = empLeave?.paidLeaveDays || 0;
        const unpaidLeaveDays = empLeave?.unpaidLeaveDays || 0;
        const totalLeaveDays = paidLeaveDays + unpaidLeaveDays;

        // Adjusted required hours = standard hours minus all leave hours
        const adjustedRequiredHours = Math.max(0, standardHoursInRange - totalLeaveDays * HOURS_PER_DAY);

        // Payable/extra hours are calculated against adjusted required hours
        let payableHours = Math.min(actualHours, adjustedRequiredHours);
        let extraHours = Math.max(0, actualHours - adjustedRequiredHours);

        // TIME BANK ADJUSTMENT: if employee worked fewer hours than adjusted required,
        // cover the gap from their stored time bank
        if (payableHours < adjustedRequiredHours) {
          const missingHours = adjustedRequiredHours - payableHours;
          const bank = timeBankByEmployee.get(emp.id);
          if (bank && bank.available > 0) {
            const coveredHours = Math.min(missingHours, bank.available);
            payableHours += coveredHours;
            bankHoursUsed = coveredHours;

            // Deduct from bank records (FIFO)
            let remaining = coveredHours;
            for (const rec of bank.records) {
              if (remaining <= 0) break;
              const deduct = Math.min(remaining, rec.available);
              timeBankUpdates.push({ id: rec.id, addUsedHours: deduct });
              rec.available -= deduct;
              remaining -= deduct;
            }
            bank.available -= coveredHours;
          }
        }

        // Add paid leave hours (employee gets paid for these without working)
        const paidLeaveHours = paidLeaveDays * HOURS_PER_DAY;
        payableHours += paidLeaveHours;

        grossPay = payableHours * hourlyRate;

        // Calculate deductions using system formulas (rate × gross pay)
        const ded = calculateDeductions(grossPay, region);

        // ── EMI deduction for active loans ──
        let totalLoanEmi = 0;
        const empLoans = loansByEmployee.get(emp.id);
        if (empLoans) {
          for (const loan of empLoans) {
            // Cap EMI: remaining balance or EMI, whichever is smaller
            let emiAmount = Math.min(loan.emi, loan.remainingBalance);
            // Prevent negative net pay: cap total EMI so net >= 0
            const availableForEmi = grossPay - ded.totalDeductions - totalLoanEmi;
            if (availableForEmi <= 0) break;
            emiAmount = Math.min(emiAmount, availableForEmi);
            if (emiAmount <= 0) break;
            emiAmount = Math.round(emiAmount * 100) / 100;
            totalLoanEmi += emiAmount;
            emiDeductions.push({ loanId: loan.id, amount: emiAmount });
          }
        }

        const netPay = grossPay - ded.totalDeductions - totalLoanEmi;

        totalGross += grossPay;
        totalDeductions += ded.totalDeductions + totalLoanEmi;
        employeeCount++;

        employeePayrollDetails.push({
          employee_id: emp.id,
          user_id: userId,
          employee_name: `${emp.first_name} ${emp.last_name}`,
          department: emp.department || "",
          hourly_rate: Math.round(hourlyRate * 100) / 100,
          days_worked: daysWorked,
          actual_hours: Math.round(actualHours * 10) / 10,
          payable_hours: Math.round(payableHours * 10) / 10,
          extra_hours: Math.round(extraHours * 10) / 10,
          bank_hours_used: Math.round(bankHoursUsed * 10) / 10,
          paid_leave_days: paidLeaveDays,
          unpaid_leave_days: unpaidLeaveDays,
          gross_pay: Math.round(grossPay * 100) / 100,
          income_tax: ded.incomeTax,
          social_security: ded.socialSecurity,
          provident_fund: ded.providentFund,
          loan_emi: totalLoanEmi,
          deductions: ded.totalDeductions + totalLoanEmi,
          net_pay: Math.round(netPay * 100) / 100,
        });

        if (userId) {
          overtimeRecords.push({
            user_id: userId,
            employee_id: emp.id,
            standard_hours: standardHoursInRange,
            actual_hours: Math.round(actualHours * 10) / 10,
            extra_hours: Math.round(extraHours * 10) / 10,
          });
        }
      });

      // Create the payroll run
      const result = await createPayrollRun(periodStart, periodEnd);

      if (result) {
        const { error: updateError } = await supabase
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

        if (updateError) {
          console.error("Failed to update payroll run:", updateError);
        }

        if (employeePayrollDetails.length > 0) {
          const detailInserts = employeePayrollDetails.map(d => ({
            payroll_run_id: result.id,
            employee_id: d.employee_id,
            user_id: d.user_id || null,
            employee_name: d.employee_name,
            department: d.department,
            hourly_rate: d.hourly_rate,
            days_worked: d.days_worked,
            actual_hours: d.actual_hours,
            payable_hours: d.payable_hours,
            extra_hours: d.extra_hours,
            bank_hours_used: d.bank_hours_used,
            paid_leave_days: d.paid_leave_days,
            unpaid_leave_days: d.unpaid_leave_days,
            gross_pay: d.gross_pay,
            income_tax: d.income_tax,
            social_security: d.social_security,
            provident_fund: d.provident_fund,
            loan_emi: d.loan_emi,
            deductions: d.deductions,
            net_pay: d.net_pay,
          }));

          const { error: detailError } = await supabase.from("payroll_run_details").insert(detailInserts);
          if (detailError) {
            console.error("Failed to insert payroll run details:", detailError);
            toast({ title: "Warning", description: "Payroll run created but failed to save details: " + detailError.message, variant: "destructive" });
            // Abort: don't record EMI deductions or overtime if details failed
            setIsCalculating(false);
            await refetchEmployees();
            setModalParam(null);
            return;
          }
        }

        // Record EMI deductions via RPC (creates loan_repayments + updates balances)
        for (const emi of emiDeductions) {
          await (supabase.rpc as any)("record_payroll_emi_deduction", {
            p_loan_request_id: emi.loanId,
            p_payroll_run_id: result.id,
            p_emi_amount: emi.amount,
            p_recorded_by: user?.id,
          });
        }

        // Save NEW extra hours to overtime_bank for this period
        if (overtimeRecords.length > 0) {
          const bankInserts = overtimeRecords.map(rec => ({
            user_id: rec.user_id,
            employee_id: rec.employee_id,
            payroll_run_id: result.id,
            period_month: periodStart.getMonth() + 1,
            period_year: periodStart.getFullYear(),
            standard_hours: rec.standard_hours,
            actual_hours: rec.actual_hours,
            extra_hours: rec.extra_hours,
            used_hours: 0,
          }));

          await supabase.from("overtime_bank").upsert(bankInserts, {
            onConflict: "user_id,period_month,period_year",
          });
        }

        // Apply time bank deductions (update used_hours on older records)
        for (const update of timeBankUpdates) {
          await (supabase.rpc as any)("increment_used_hours", {
            record_id: update.id,
            hours_to_add: update.addUsedHours,
          });
        }

        const currencySymbol = region === "US" ? "$" : "₨";
        const periodLabel = `${format(periodStart, "MMM d")} – ${format(periodEnd, "MMM d, yyyy")}`;
        toast({
          title: `Payroll Processed — ${periodLabel}`,
          description: `${employeeCount} employees | Total: ${currencySymbol}${totalGross.toLocaleString(undefined, { maximumFractionDigits: 0 })}. Extra hours saved.`,
        });
        setModalParam(null);

        // ── Background: generate payslip PDFs for all employees ──
        const payslipData: PayslipEmployeeData[] = employeePayrollDetails.map(d => ({
          employee_id: d.employee_id,
          user_id: d.user_id,
          employee_name: d.employee_name,
          department: d.department,
          hourly_rate: d.hourly_rate,
          days_worked: d.days_worked,
          actual_hours: d.actual_hours,
          payable_hours: d.payable_hours,
          extra_hours: d.extra_hours,
          bank_hours_used: d.bank_hours_used,
          paid_leave_days: d.paid_leave_days,
          unpaid_leave_days: d.unpaid_leave_days,
          gross_pay: d.gross_pay,
          income_tax: d.income_tax,
          social_security: d.social_security,
          provident_fund: d.provident_fund,
          loan_emi: d.loan_emi,
          deductions: d.deductions,
          net_pay: d.net_pay,
        }));

        const payslipCtx: PayslipRunContext = {
          payroll_run_id: result.id,
          period_start: formatLocalDate(periodStart),
          period_end: formatLocalDate(periodEnd),
          region,
          total_working_days: workDaysInRange,
          required_hours: standardHoursInRange,
          company_name: companySettings.companyName,
        };

        // Fire-and-forget — runs in background, shows its own progress toast
        generateAndUploadPayslips(payslipData, payslipCtx);
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

    // Recalculate required hours from the period dates so CSV is accurate
    const { workDays: rangeWorkDays, requiredHours: rangeRequiredHours } = calculateWorkingHours(periodStart, periodEnd);
    const { requiredHours: monthlyRequiredHours } = calculateMonthlyWorkingHours(periodStart);

    const exportRows = details.map((d: any) =>
      mapDetailToExportRow(d, rangeRequiredHours, monthlyRequiredHours, rangeWorkDays, region)
    );
    exportPayrollCSV(exportRows, region, periodStart);
    toast({ title: "Downloaded", description: `Payroll CSV for ${format(new Date(periodStart + "T00:00:00"), "MMMM yyyy")} exported` });
  };

  const handleViewRunDetails = async (runId: string, periodStart: string, periodEnd: string) => {
    const { data: details, error } = await supabase
      .from("payroll_run_details")
      .select("*")
      .eq("payroll_run_id", runId)
      .order("employee_name");

    if (error || !details || details.length === 0) {
      toast({ title: "No Data", description: "No payroll details found for this run", variant: "destructive" });
      return;
    }

    // Recalculate required hours from the stored period dates
    const { workDays: rangeWorkDays, requiredHours: rangeRequiredHours } = calculateWorkingHours(periodStart, periodEnd);

    const rows: PayrollRow[] = details.map((d: any) => ({
      employee_name: d.employee_name,
      department: d.department || "",
      hourly_rate: d.hourly_rate || 0,
      total_working_days: rangeWorkDays,
      days_worked: d.days_worked || 0,
      required_hours: rangeRequiredHours,
      actual_hours: d.actual_hours || 0,
      payable_hours: d.payable_hours || 0,
      extra_hours: d.extra_hours || 0,
      bank_hours_used: d.bank_hours_used || 0,
      paid_leave_days: d.paid_leave_days || 0,
      unpaid_leave_days: d.unpaid_leave_days || 0,
      gross_pay: d.gross_pay || 0,
      income_tax: d.income_tax ?? 0,
      social_security: d.social_security ?? 0,
      provident_fund: d.provident_fund ?? 0,
      loan_emi: d.loan_emi ?? 0,
      deductions: d.deductions || 0,
      net_pay: d.net_pay || 0,
    }));

    setViewRunRows(rows);
    setViewRunPeriod({ start: periodStart, end: periodEnd });
    setViewRunId(runId);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set("runId", runId);
      return next;
    }, { replace: true });
  };

  const handleCloseRunView = () => {
    setViewRunId(null);
    setViewRunRows([]);
    setViewRunPeriod(null);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.delete("runId");
      return next;
    }, { replace: true });
  };

  const handleExport = () => {
    // Export with employee data
    const currencySymbol = region === "US" ? "$" : "Rs.";

    // Calculate required hours for the current month (general export uses current month)
    const { requiredHours: monthlyReqHours } = calculateMonthlyWorkingHours(new Date());
    
    const headers = [
      "Employee Name",
      "Email", 
      "Department",
      "Job Title",
      "Pay Type",
      "Monthly Salary",
      "Hourly Rate",
      "Required Hours",
      "Actual Hours",
      "Payable Hours",
      "Extra Hours",
      "Gross Pay",
      "Income Tax",
      "Social Security",
      "Provident Fund",
      "Total Deductions",
      "Net Pay"
    ];

    const rows = regionEmployees.map(emp => {
      const attendance = teamAttendance.find(a => a.employee_id === emp.id);
      const actualHours = attendance?.total_hours || 0;

      // Derive hourly rate
      let empHourlyRate = 0;
      if (emp.pay_type === "hourly" && emp.hourly_rate) {
        empHourlyRate = emp.hourly_rate;
      } else if (emp.salary) {
        empHourlyRate = hourlyRateFromSalary(emp.salary, monthlyReqHours);
      }

      // Payable = min(actual, required), extra = anything above required
      const payableHours = Math.min(actualHours, monthlyReqHours);
      const extraHours = Math.max(0, actualHours - monthlyReqHours);
      const grossPay = payableHours * empHourlyRate;

      const ded = calculateDeductions(grossPay, region);
      const netPay = grossPay - ded.totalDeductions;

      return [
        `"${emp.first_name} ${emp.last_name}"`,
        emp.email,
        emp.department || "",
        emp.job_title || "",
        emp.pay_type || "salary",
        emp.salary || 0,
        empHourlyRate.toFixed(2),
        monthlyReqHours.toFixed(1),
        actualHours.toFixed(1),
        payableHours.toFixed(1),
        extraHours.toFixed(1),
        grossPay.toFixed(2),
        ded.incomeTax.toFixed(2),
        ded.socialSecurity.toFixed(2),
        ded.providentFund.toFixed(2),
        ded.totalDeductions.toFixed(2),
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
    
    const { requiredHours: monthlyReqHours } = calculateMonthlyWorkingHours(new Date());
    let totalGross = 0;
    let totalDeductions = 0;
    
    regionEmployees.forEach(emp => {
      const attendance = teamAttendance.find(a => a.employee_id === emp.id);
      const actualHours = attendance?.total_hours || 0;
      
      // Derive hourly rate
      let empHourlyRate = 0;
      if (emp.pay_type === "hourly" && emp.hourly_rate) {
        empHourlyRate = emp.hourly_rate;
      } else if (emp.salary) {
        empHourlyRate = hourlyRateFromSalary(emp.salary, monthlyReqHours);
      }

      const payableHours = Math.min(actualHours, monthlyReqHours);
      const grossPay = payableHours * empHourlyRate;

      const ded = calculateDeductions(grossPay, region);

      totalGross += grossPay;
      totalDeductions += ded.totalDeductions;
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
    setModalParam("editSalary", employee.id);
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
          <h1 className="heading-page font-display font-bold text-foreground">{isVP ? "Payroll" : "My Payslips"}</h1>
          <p className="text-muted-foreground mt-1">
            {isVP ? "Manage payroll processing and compensation" : "View and download your payslip PDFs"}
          </p>
        </div>
        {isVP && (
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
          <Button variant="outline" className="gap-2" onClick={() => setModalParam("exportPreview")}>
            <Download className="h-4 w-4" />
            Export
          </Button>
          {isVP && (
            <Button className="gap-2 shadow-md" onClick={() => setModalParam("runPayroll")} disabled={isCalculating}>
              {isCalculating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}
              {isCalculating ? "Processing..." : "Run Payroll"}
            </Button>
          )}
        </div>
        )}
      </div>

      {/* Tabs – show tab bar only for VP/admin users who have multiple tabs */}
      {isVP && (
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="mb-6">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="overview">Payroll Overview</TabsTrigger>
          <TabsTrigger value="calculator">Salary Calculator</TabsTrigger>
          <TabsTrigger value="attendance">Employee Attendance</TabsTrigger>
          <TabsTrigger value="employees">Manage Salaries</TabsTrigger>
          <TabsTrigger value="contractor">Contractor Portal</TabsTrigger>
          <TabsTrigger value="my-payslips">My Payslips</TabsTrigger>
        </TabsList>
      </Tabs>
      )}

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
                      <p className="text-sm text-muted-foreground">Avg. Monthly Salary</p>
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
                      <p className="text-sm text-muted-foreground">Avg. Monthly Salary</p>
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
                    onClick={() => setModalParam("payslips")}
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

          {/* Payslip Generation Progress */}
          {generatingPayslips && payslipProgress && (
            <Card className="mt-6 border-primary/30 bg-primary/5">
              <CardContent className="py-4">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      Generating Payslips… {payslipProgress.completed}/{payslipProgress.total}
                    </p>
                    <p className="text-xs text-muted-foreground">{payslipProgress.current}</p>
                    <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-300"
                        style={{ width: `${(payslipProgress.completed / payslipProgress.total) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

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
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="gap-1.5"
                                    onClick={() => handleViewRunDetails(payroll.id, payroll.period_start, payroll.period_end)}
                                  >
                                    <Eye className="h-3.5 w-3.5" />
                                    View
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="gap-1.5"
                                    onClick={() => handleDownloadRunCSV(payroll.id, payroll.period_start, payroll.period_end)}
                                  >
                                    <Download className="h-3.5 w-3.5" />
                                    CSV
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="gap-1.5"
                                    onClick={() => downloadAllAsZip(payroll.id, payroll.period_start)}
                                  >
                                    <FileDown className="h-3.5 w-3.5" />
                                    Payslips
                                  </Button>
                                </>
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

          {/* AG Grid Detail View for a selected payroll run */}
          {viewRunId && viewRunRows.length > 0 && viewRunPeriod && (
            <div className="mt-6 space-y-4">
              <div className="flex justify-end">
                <Button variant="ghost" size="sm" onClick={handleCloseRunView}>
                  Close Detail View
                </Button>
              </div>
              <PayrollDataGrid
                rows={viewRunRows}
                region={region}
                periodStart={viewRunPeriod.start}
                periodEnd={viewRunPeriod.end}
                payslipRecords={payslipRecords}
                onDownloadPayslip={downloadPayslip}
                onDownloadAllPayslips={() => viewRunId && viewRunPeriod && downloadAllAsZip(viewRunId, viewRunPeriod.start)}
              />
            </div>
          )}
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
                    <TableHead className="text-right">Monthly Salary</TableHead>
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
                        <TableRow
                          key={employee.id}
                          className="animate-fade-in cursor-pointer hover:bg-muted/50"
                          style={{ animationDelay: `${100 + index * 30}ms` }}
                          onClick={() => handleEditEmployee(employee)}
                        >
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
                              onClick={(e) => { e.stopPropagation(); handleEditEmployee(employee); }}
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
                          setModalParam("myBreakdown", myEmployee.id);
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
            onEditEmployee={(emp) => handleEditEmployee(emp as any)}
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
      ) : activeTab === "my-payslips" ? (
        /* My Payslips - available to all employees */
        <MyPayslipsTab downloadPayslip={downloadPayslip} />
      ) : null}

      {/* Dialogs */}
      <RunPayrollDialog
        open={showRunPayrollDialog}
        onOpenChange={(open) => setModalParam(open ? "runPayroll" : null)}
        onRun={handleRunPayroll}
        isProcessing={isCalculating}
      />

      <PayslipsPreviewDialog
        open={showPayslipsPreview}
        onOpenChange={(open) => setModalParam(open ? "payslips" : null)}
        employees={regionEmployees}
        region={region}
        taxRates={taxRates}
        teamAttendance={teamAttendance}
      />

      <EditEmployeeSalaryDialog
        open={showEditSalary}
        onOpenChange={(open) => setModalParam(open ? "editSalary" : null)}
        employee={selectedEmployee}
        employees={employees}
        onSave={handleSaveEmployee}
      />

      <SalaryBreakdownDialog
        open={showMyBreakdown}
        onOpenChange={(open) => setModalParam(open ? "myBreakdown" : null)}
        employee={selectedEmployee}
        editable={false}
      />

      <PayrollExportPreviewDialog
        open={showExportPreview}
        onOpenChange={(open) => setModalParam(open ? "exportPreview" : null)}
        employees={regionEmployees}
        region={region}
        teamAttendance={teamAttendance}
        activeLoans={activeLoansForPreview}
        approvedLeaves={approvedLeavesForPreview}
      />
    </DashboardLayout>
  );
};

export default Payroll;
