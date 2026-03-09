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
} from "@/lib/payrollHours";

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
  grossPay: number;
  incomeTax: number;
  socialSecurity: number;
  providentFund: number;
  totalDeductions: number;
  netPay: number;
}

export function PayrollExportPreviewDialog({
  open,
  onOpenChange,
  employees,
  region,
  teamAttendance,
}: PayrollExportPreviewDialogProps) {
  const currencySymbol = region === "US" ? "$" : "₨";

  const { rows, workDays, monthlyReqHours } = useMemo(() => {
    const { workDays, requiredHours } = calculateMonthlyWorkingHours(new Date());
    const result: PreviewRow[] = [];

    employees.forEach((emp) => {
      const attendance = teamAttendance.find((a) => a.employee_id === emp.id);
      const actualHours = attendance?.total_hours || 0;

      let empHourlyRate = 0;
      if (emp.pay_type === "hourly" && emp.hourly_rate) {
        empHourlyRate = emp.hourly_rate;
      } else if (emp.salary) {
        empHourlyRate = hourlyRateFromSalary(emp.salary, requiredHours);
      }

      const payableHours = Math.min(actualHours, requiredHours);
      const extraHours = Math.max(0, actualHours - requiredHours);
      const grossPay = payableHours * empHourlyRate;

      // Calculate deductions from system formulas (rate × gross pay)
      const ded = calculateDeductions(grossPay, region);
      const netPay = grossPay - ded.totalDeductions;

      result.push({
        name: `${emp.first_name} ${emp.last_name}`,
        department: emp.department || "-",
        hourlyRate: Math.round(empHourlyRate * 100) / 100,
        totalWorkingDays: workDays,
        requiredHours,
        actualHours: Math.round(actualHours * 10) / 10,
        payableHours: Math.round(payableHours * 10) / 10,
        extraHours: Math.round(extraHours * 10) / 10,
        grossPay: Math.round(grossPay * 100) / 100,
        incomeTax: ded.incomeTax,
        socialSecurity: ded.socialSecurity,
        providentFund: ded.providentFund,
        totalDeductions: ded.totalDeductions,
        netPay: Math.round(netPay * 100) / 100,
      });
    });

    return { rows: result, workDays, monthlyReqHours: requiredHours };
  }, [employees, teamAttendance, region]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => ({
        grossPay: acc.grossPay + r.grossPay,
        incomeTax: acc.incomeTax + r.incomeTax,
        socialSecurity: acc.socialSecurity + r.socialSecurity,
        providentFund: acc.providentFund + r.providentFund,
        totalDeductions: acc.totalDeductions + r.totalDeductions,
        netPay: acc.netPay + r.netPay,
      }),
      { grossPay: 0, incomeTax: 0, socialSecurity: 0, providentFund: 0, totalDeductions: 0, netPay: 0 }
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
      "Gross Pay": r.grossPay,
      "Income Tax": r.incomeTax,
      "Social Security": r.socialSecurity,
      "Provident Fund": r.providentFund,
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
                <TableHead className="text-right">Gross</TableHead>
                <TableHead className="text-right">Income Tax</TableHead>
                <TableHead className="text-right">Social Sec</TableHead>
                <TableHead className="text-right">Prov Fund</TableHead>
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
                    colSpan={14}
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
                    <TableCell colSpan={7}></TableCell>
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
