import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, FileText } from "lucide-react";

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  salary: number | null;
  hourly_rate: number | null;
  pay_type: string | null;
  department: string | null;
}

interface PayslipsPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employees: Employee[];
  region: "US" | "Nepal";
  taxRates: Record<string, number>;
  teamAttendance: { user_id: string; employee_id: string; total_hours: number }[];
}

export function PayslipsPreviewDialog({ 
  open, 
  onOpenChange, 
  employees, 
  region, 
  taxRates,
  teamAttendance 
}: PayslipsPreviewDialogProps) {
  const currencySymbol = region === "US" ? "$" : "₨";

  const calculatePayslip = (employee: Employee) => {
    // Find attendance for this employee
    const attendance = teamAttendance.find(a => a.employee_id === employee.id);
    const hoursWorked = attendance?.total_hours || 0;

    let grossPay = 0;
    if (employee.pay_type === "hourly" && employee.hourly_rate) {
      grossPay = hoursWorked * employee.hourly_rate;
    } else if (employee.salary) {
      // Monthly salary (annual / 12)
      grossPay = employee.salary / 12;
    }

    // Calculate deductions
    let totalDeductions = 0;
    if (region === "US") {
      totalDeductions = grossPay * (
        (taxRates.federal || 0) + 
        (taxRates.state || 0) + 
        (taxRates.fica || 0) + 
        (taxRates.medicare || 0)
      );
    } else {
      totalDeductions = grossPay * (
        (taxRates.incomeTax || 0) + 
        (taxRates.socialSecurity || 0) + 
        (taxRates.providentFund || 0)
      );
    }

    const netPay = grossPay - totalDeductions;

    return { grossPay, totalDeductions, netPay, hoursWorked };
  };

  const payslips = employees.map(emp => ({
    ...emp,
    ...calculatePayslip(emp)
  }));

  const totals = payslips.reduce((acc, p) => ({
    grossPay: acc.grossPay + p.grossPay,
    totalDeductions: acc.totalDeductions + p.totalDeductions,
    netPay: acc.netPay + p.netPay
  }), { grossPay: 0, totalDeductions: 0, netPay: 0 });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Payslips Preview - {region}
          </DialogTitle>
        </DialogHeader>
        
        <div className="mt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Department</TableHead>
                <TableHead className="text-right">Hours</TableHead>
                <TableHead className="text-right">Gross Pay</TableHead>
                <TableHead className="text-right">Deductions</TableHead>
                <TableHead className="text-right">Net Pay</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payslips.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No employees found for {region}
                  </TableCell>
                </TableRow>
              ) : (
                payslips.map((payslip) => (
                  <TableRow key={payslip.id}>
                    <TableCell className="font-medium">
                      {payslip.first_name} {payslip.last_name}
                    </TableCell>
                    <TableCell>{payslip.department || "-"}</TableCell>
                    <TableCell className="text-right">{payslip.hoursWorked.toFixed(1)}h</TableCell>
                    <TableCell className="text-right">
                      {currencySymbol}{payslip.grossPay.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </TableCell>
                    <TableCell className="text-right text-destructive">
                      -{currencySymbol}{payslip.totalDeductions.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {currencySymbol}{payslip.netPay.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </TableCell>
                  </TableRow>
                ))
              )}
              {payslips.length > 0 && (
                <TableRow className="font-bold bg-muted/50">
                  <TableCell colSpan={3}>Total</TableCell>
                  <TableCell className="text-right">
                    {currencySymbol}{totals.grossPay.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </TableCell>
                  <TableCell className="text-right text-destructive">
                    -{currencySymbol}{totals.totalDeductions.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </TableCell>
                  <TableCell className="text-right">
                    {currencySymbol}{totals.netPay.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
