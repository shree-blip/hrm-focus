import { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Download, FileSpreadsheet } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import Papa from "papaparse";
import { saveAs } from "file-saver";
import { format } from "date-fns";
import {
  calculateMonthlyWorkingHours,
  hourlyRateFromSalary,
  calculateDeductions,
  HOURS_PER_DAY,
} from "@/lib/payrollHours";
import { calculateEMI, FIXED_ANNUAL_RATE } from "@/lib/loanCalculations";

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  department: string | null;
  job_title: string | null;
  pay_type: string | null;
  salary: number | null;
  hourly_rate: number | null;
}

interface Attendance {
  employee_id: string;
  total_hours: number;
}

interface PayrollExportPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employees: Employee[];
  region: string;
  teamAttendance: Attendance[];
  activeLoans?: Array<{
    id: string;
    employee_id: string | null;
    amount: number;
    term_months: number;
    interest_rate: number | null;
    remaining_balance: number | null;
    estimated_monthly_installment: number | null;
  }>;
  approvedLeaves?: Array<{
    user_id: string;
    leave_type: string;
    start_date: string;
    end_date: string;
    days: number;
  }>;
}

interface PreviewRow {
  name: string;
  department: string;
  hourlyRate: number;
  totalWorkingDays: number;
  requiredHours: number;
  actualHours: number;
  payableHours: number;
  extraHours: number;
  paidLeaveDays: number;
  unpaidLeaveDays: number;
  grossPay: number;
  incomeTax: number;
  socialSecurity: number;
  providentFund: number;
  loanEmi: number;
  totalDeductions: number;
  netPay: number;
}

export function PayrollExportPreviewDialog({
  open,
  onOpenChange,
  employees,
  region,
  teamAttendance,
  activeLoans,
  approvedLeaves,
}: PayrollExportPreviewDialogProps) {
  const currencySymbol = region === "US" ? "$" : "₨";

  const { rows, workDays, monthlyReqHours } = useMemo(() => {
    const { workDays, requiredHours } = calculateMonthlyWorkingHours(new Date());
    const result: PreviewRow[] = [];

    // Build loan map: employee_id → total EMI
    const emiByEmployee = new Map<string, number>();
    activeLoans?.forEach(loan => {
      if (!loan.employee_id) return;
      const remaining = Number(loan.remaining_balance ?? loan.amount);
      if (remaining <= 0) return;
      const emi = loan.estimated_monthly_installment
        || calculateEMI(Number(loan.amount), loan.interest_rate ?? FIXED_ANNUAL_RATE, loan.term_months);
      const prev = emiByEmployee.get(loan.employee_id) || 0;
      emiByEmployee.set(loan.employee_id, prev + Math.min(Math.round(emi * 100) / 100, remaining));
    });

    // Build leave map: user_id → { paidLeaveDays, unpaidLeaveDays }
    // For preview we use the whole current month as the pay period
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const UNPAID_LEAVE_TYPES = ["Other Leave"];

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

    const leaveByUserId = new Map<string, { paidLeaveDays: number; unpaidLeaveDays: number }>();
    approvedLeaves?.forEach(leave => {
      const ls = new Date(leave.start_date + "T00:00:00");
      const le = new Date(leave.end_date + "T00:00:00");
      const overlapStart = ls > monthStart ? ls : monthStart;
      const overlapEnd = le < monthEnd ? le : monthEnd;
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

    employees.forEach((emp) => {
      const attendance = teamAttendance.find((a) => a.employee_id === emp.id);
      const actualHours = attendance?.total_hours || 0;

      let empHourlyRate = 0;
      if (emp.pay_type === "hourly" && emp.hourly_rate) {
        empHourlyRate = emp.hourly_rate;
      } else if (emp.salary) {
        empHourlyRate = hourlyRateFromSalary(emp.salary, requiredHours);
      }

      // Leave adjustment
      const userId = (emp as any).user_id || "";
      const empLeave = userId ? leaveByUserId.get(userId) : undefined;
      const paidLeaveDays = empLeave?.paidLeaveDays || 0;
      const unpaidLeaveDays = empLeave?.unpaidLeaveDays || 0;
      const totalLeaveDays = paidLeaveDays + unpaidLeaveDays;

      const adjustedRequiredHours = Math.max(0, requiredHours - totalLeaveDays * HOURS_PER_DAY);
      let payableHours = Math.min(actualHours, adjustedRequiredHours);
      const extraHours = Math.max(0, actualHours - adjustedRequiredHours);

      // Add paid leave hours
      payableHours += paidLeaveDays * HOURS_PER_DAY;

      const grossPay = payableHours * empHourlyRate;

      // Calculate deductions from system formulas (rate × gross pay)
      const ded = calculateDeductions(grossPay, region);

      // Loan EMI (capped to avoid negative net)
      let loanEmi = emiByEmployee.get(emp.id) || 0;
      const availableForEmi = grossPay - ded.totalDeductions;
      if (loanEmi > availableForEmi) loanEmi = Math.max(0, availableForEmi);

      const netPay = grossPay - ded.totalDeductions - loanEmi;

      result.push({
        name: `${emp.first_name} ${emp.last_name}`,
        department: emp.department || "-",
        hourlyRate: Math.round(empHourlyRate * 100) / 100,
        totalWorkingDays: workDays,
        requiredHours,
        actualHours: Math.round(actualHours * 10) / 10,
        payableHours: Math.round(payableHours * 10) / 10,
        extraHours: Math.round(extraHours * 10) / 10,
        paidLeaveDays,
        unpaidLeaveDays,
        grossPay: Math.round(grossPay * 100) / 100,
        incomeTax: ded.incomeTax,
        socialSecurity: ded.socialSecurity,
        providentFund: ded.providentFund,
        loanEmi: Math.round(loanEmi * 100) / 100,
        totalDeductions: ded.totalDeductions + loanEmi,
        netPay: Math.round(netPay * 100) / 100,
      });
    });

    return { rows: result, workDays, monthlyReqHours: requiredHours };
  }, [employees, teamAttendance, region, activeLoans, approvedLeaves]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => ({
        grossPay: acc.grossPay + r.grossPay,
        incomeTax: acc.incomeTax + r.incomeTax,
        socialSecurity: acc.socialSecurity + r.socialSecurity,
        providentFund: acc.providentFund + r.providentFund,
        loanEmi: acc.loanEmi + r.loanEmi,
        totalDeductions: acc.totalDeductions + r.totalDeductions,
        netPay: acc.netPay + r.netPay,
      }),
      { grossPay: 0, incomeTax: 0, socialSecurity: 0, providentFund: 0, loanEmi: 0, totalDeductions: 0, netPay: 0 }
    );
  }, [rows]);

  const handleDownloadCSV = () => {
    const csvRows = rows.map((r) => ({
      "Employee Name": r.name,
      Department: r.department,
      "Hourly Rate": r.hourlyRate,
      "Total Working Days": r.totalWorkingDays,
      "Required Hours": r.requiredHours,
      "Actual Hours": r.actualHours,
      "Payable Hours": r.payableHours,
      "Extra Hours": r.extraHours,
      "Paid Leave Days": r.paidLeaveDays,
      "Unpaid Leave Days": r.unpaidLeaveDays,
      "Gross Pay": r.grossPay,
      "Income Tax": r.incomeTax,
      "Social Security": r.socialSecurity,
      "Provident Fund": r.providentFund,
      "Loan EMI": r.loanEmi,
      "Total Deductions": r.totalDeductions,
      "Net Pay": r.netPay,
    }));

    const csv = Papa.unparse(csvRows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const fileName = `payroll-${region}-${format(new Date(), "yyyy-MM")}.csv`;
    saveAs(blob, fileName);
  };

  const fmt = (v: number) =>
    `${currencySymbol}${v.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Payroll Export Preview — {format(new Date(), "MMMM yyyy")}
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          {rows.length} employees • {workDays} working days • {monthlyReqHours}h
          required
        </p>

        <ScrollArea className="flex-1 max-h-[55vh] border rounded-md">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent text-xs">
                <TableHead className="sticky left-0 bg-background z-10">
                  Employee
                </TableHead>
                <TableHead>Dept</TableHead>
                <TableHead className="text-right">Rate</TableHead>
                <TableHead className="text-right">Days</TableHead>
                <TableHead className="text-right">Req Hrs</TableHead>
                <TableHead className="text-right">Actual</TableHead>
                <TableHead className="text-right">Payable</TableHead>
                <TableHead className="text-right">Extra</TableHead>
                <TableHead className="text-right">Paid Lv</TableHead>
                <TableHead className="text-right">Unpaid Lv</TableHead>
                <TableHead className="text-right">Gross</TableHead>
                <TableHead className="text-right">Income Tax</TableHead>
                <TableHead className="text-right">Social Sec</TableHead>
                <TableHead className="text-right">Prov Fund</TableHead>
                <TableHead className="text-right">Loan EMI</TableHead>
                <TableHead className="text-right">Total Ded</TableHead>
                <TableHead className="text-right font-semibold">
                  Net Pay
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={17}
                    className="text-center py-8 text-muted-foreground"
                  >
                    No employees found for this region
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {rows.map((r, i) => (
                    <TableRow key={i} className="text-xs">
                      <TableCell className="sticky left-0 bg-background font-medium">
                        {r.name}
                      </TableCell>
                      <TableCell>{r.department}</TableCell>
                      <TableCell className="text-right">
                        {fmt(r.hourlyRate)}
                      </TableCell>
                      <TableCell className="text-right">
                        {r.totalWorkingDays}
                      </TableCell>
                      <TableCell className="text-right">
                        {r.requiredHours}h
                      </TableCell>
                      <TableCell className="text-right">
                        {r.actualHours}h
                      </TableCell>
                      <TableCell className="text-right">
                        {r.payableHours}h
                      </TableCell>
                      <TableCell className="text-right">
                        {r.extraHours}h
                      </TableCell>
                      <TableCell className="text-right">
                        {r.paidLeaveDays > 0 ? r.paidLeaveDays : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {r.unpaidLeaveDays > 0 ? r.unpaidLeaveDays : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {fmt(r.grossPay)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {fmt(r.incomeTax)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {fmt(r.socialSecurity)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {fmt(r.providentFund)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {r.loanEmi > 0 ? fmt(r.loanEmi) : "-"}
                      </TableCell>
                      <TableCell className="text-right text-destructive">
                        {fmt(r.totalDeductions)}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-success">
                        {fmt(r.netPay)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Totals row */}
                  <TableRow className="border-t-2 font-semibold text-xs">
                    <TableCell className="sticky left-0 bg-background">
                      Total ({rows.length} employees)
                    </TableCell>
                    <TableCell colSpan={9}></TableCell>
                    <TableCell className="text-right">
                      {fmt(totals.grossPay)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {fmt(totals.incomeTax)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {fmt(totals.socialSecurity)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {fmt(totals.providentFund)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {totals.loanEmi > 0 ? fmt(totals.loanEmi) : "-"}
                    </TableCell>
                    <TableCell className="text-right text-destructive">
                      {fmt(totals.totalDeductions)}
                    </TableCell>
                    <TableCell className="text-right text-success">
                      {fmt(totals.netPay)}
                    </TableCell>
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </ScrollArea>

        <DialogFooter className="flex items-center justify-between sm:justify-between">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            className="gap-2"
            onClick={handleDownloadCSV}
            disabled={rows.length === 0}
          >
            <Download className="h-4 w-4" />
            Download CSV
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
