import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Calculator, Eye, Download, TrendingUp, Info } from "lucide-react";
import { calculateNepalPayroll, formatNPR } from "@/lib/nepalPayroll";
import { SalaryBreakdownDialog } from "./SalaryBreakdownDialog";
import { toast } from "@/hooks/use-toast";

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  salary: number | null;
  department: string | null;
  job_title: string | null;
  gender?: string | null;
  insurance_premium?: number | null;
  include_dashain_bonus?: boolean | null;
  pay_type: string | null;
}

interface NepalPayrollTableProps {
  employees: Employee[];
  isAdmin: boolean;
  onUpdateEmployee?: (employeeId: string, updates: Record<string, unknown>) => void;
}

export function NepalPayrollTable({ employees, isAdmin, onUpdateEmployee }: NepalPayrollTableProps) {
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [globalDashain, setGlobalDashain] = useState(false);

  const nepalEmployees = employees.filter((e) => e.salary && e.salary > 0);

  const calculations = nepalEmployees.map((emp) => {
    const breakdown = calculateNepalPayroll({
      annualSalary: emp.salary!,
      gender: (emp.gender as "male" | "female") || null,
      insurancePremium: emp.insurance_premium || 0,
      includeDashainBonus: emp.include_dashain_bonus ?? globalDashain,
    });
    return { employee: emp, breakdown };
  });

  const totals = calculations.reduce(
    (acc, { breakdown }) => ({
      monthlyCTC: acc.monthlyCTC + breakdown.monthlyCTC,
      monthlyGross: acc.monthlyGross + breakdown.monthlyGross,
      monthlySSF: acc.monthlySSF + breakdown.monthlyEmployeeSSF,
      monthlyTDS: acc.monthlyTDS + breakdown.monthlyTDS,
      monthlyNet: acc.monthlyNet + breakdown.monthlyNetSalary,
      employerSSF: acc.employerSSF + breakdown.monthlyEmployerSSF,
    }),
    { monthlyCTC: 0, monthlyGross: 0, monthlySSF: 0, monthlyTDS: 0, monthlyNet: 0, employerSSF: 0 },
  );

  const handleViewBreakdown = (emp: Employee) => {
    setSelectedEmployee(emp);
    setShowBreakdown(true);
  };

  const handleSaveOptions = (
    employeeId: string,
    updates: { insurance_premium: number; include_dashain_bonus: boolean },
  ) => {
    if (onUpdateEmployee) {
      onUpdateEmployee(employeeId, updates);
      toast({ title: "Saved", description: "Employee payroll options updated" });
    }
  };

  const handleExportCSV = () => {
    const headers = [
      "Employee",
      "Department",
      "Gender",
      "Annual CTC",
      "Monthly CTC",
      "Monthly Gross",
      "Basic (60%)",
      "Allowance (40%)",
      "Employer SSF (20%)",
      "Employee SSF (11%)",
      "Taxable Income",
      "TDS",
      "Insurance",
      "Monthly Net",
    ];
    const rows = calculations.map(({ employee: emp, breakdown: b }) =>
      [
        `"${emp.first_name} ${emp.last_name}"`,
        emp.department || "",
        emp.gender || "N/A",
        emp.salary,
        b.monthlyCTC.toFixed(0),
        b.monthlyGross.toFixed(0),
        b.monthlyBasicSalary.toFixed(0),
        b.monthlyAllowance.toFixed(0),
        b.monthlyEmployerSSF.toFixed(0),
        b.monthlyEmployeeSSF.toFixed(0),
        b.taxableIncome.toFixed(0),
        b.monthlyTDS.toFixed(0),
        b.monthlyInsurance.toFixed(0),
        b.monthlyNetSalary.toFixed(0),
      ].join(","),
    );

    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nepal-payroll-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Exported", description: `${calculations.length} employee records exported` });
  };

  return (
    <>
      <div className="space-y-6">
        {/* Info Banner */}
        <div className="flex items-start gap-2 p-3 bg-info/10 border border-info/20 rounded-lg text-sm text-info">
          <Info className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <strong>Nepal Payroll (FY 2081/82):</strong> Salary entered is <strong>CTC</strong> (includes employer's 20%
            SSF). Employee gross = CTC ÷ 1.12. The 1% Social Security Tax on first Rs. 5L is covered by SSF. TDS only
            applies to taxable income <strong>exceeding Rs. 5 Lakh</strong>.
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">Employees</p>
              <p className="text-xl font-bold">{nepalEmployees.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">Monthly CTC</p>
              <p className="text-xl font-bold text-foreground">{formatNPR(totals.monthlyCTC)}</p>
              <p className="text-[10px] text-muted-foreground">incl. employer SSF</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">Employee SSF (11%)</p>
              <p className="text-xl font-bold text-destructive">{formatNPR(totals.monthlySSF)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">Total TDS</p>
              <p className="text-xl font-bold text-destructive">{formatNPR(totals.monthlyTDS)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">Monthly Net</p>
              <p className="text-xl font-bold text-success">{formatNPR(totals.monthlyNet)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Controls */}
        {isAdmin && (
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch checked={globalDashain} onCheckedChange={setGlobalDashain} />
              <Label className="text-sm">Include Dashain Bonus (all)</Label>
            </div>
            <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-1.5">
              <Download className="h-4 w-4" /> Export Payroll
            </Button>
          </div>
        )}

        {/* Main Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Calculator className="h-5 w-5 text-primary" />
              Nepal Payroll — Auto Calculated (FY 2081/82)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Dept</TableHead>
                    <TableHead>Gender</TableHead>
                    <TableHead className="text-right">CTC</TableHead>
                    <TableHead className="text-right">Gross</TableHead>
                    <TableHead className="text-right">SSF (11%)</TableHead>
                    <TableHead className="text-right">TDS</TableHead>
                    <TableHead className="text-right">Net Salary</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {calculations.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        No employees with salary data found for Nepal
                      </TableCell>
                    </TableRow>
                  ) : (
                    calculations.map(({ employee: emp, breakdown: b }, index) => (
                      <TableRow key={emp.id} className="animate-fade-in" style={{ animationDelay: `${index * 30}ms` }}>
                        <TableCell className="font-medium">
                          <div>
                            {emp.first_name} {emp.last_name}
                          </div>
                          {b.taxableAboveExemption <= 0 && (
                            <span className="text-[10px] text-success">No TDS (Below 5L)</span>
                          )}
                        </TableCell>
                        <TableCell>{emp.department || "-"}</TableCell>
                        <TableCell>
                          {emp.gender ? (
                            <Badge variant="outline" className="capitalize text-xs">
                              {emp.gender}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">N/A</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">{formatNPR(b.monthlyCTC)}</TableCell>
                        <TableCell className="text-right">{formatNPR(b.monthlyGross)}</TableCell>
                        <TableCell className="text-right text-destructive">
                          -{formatNPR(b.monthlyEmployeeSSF)}
                        </TableCell>
                        <TableCell className="text-right text-destructive">
                          {b.monthlyTDS > 0 ? `-${formatNPR(b.monthlyTDS)}` : "Rs. 0"}
                        </TableCell>
                        <TableCell className="text-right font-bold text-success">
                          {formatNPR(b.monthlyNetSalary)}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleViewBreakdown(emp)}
                            title="View full breakdown"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                  {calculations.length > 0 && (
                    <TableRow className="font-bold bg-muted/50">
                      <TableCell colSpan={3}>Total ({calculations.length} employees)</TableCell>
                      <TableCell className="text-right text-muted-foreground">{formatNPR(totals.monthlyCTC)}</TableCell>
                      <TableCell className="text-right">{formatNPR(totals.monthlyGross)}</TableCell>
                      <TableCell className="text-right text-destructive">-{formatNPR(totals.monthlySSF)}</TableCell>
                      <TableCell className="text-right text-destructive">-{formatNPR(totals.monthlyTDS)}</TableCell>
                      <TableCell className="text-right text-success">{formatNPR(totals.monthlyNet)}</TableCell>
                      <TableCell />
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Employer Cost Card */}
        {isAdmin && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-warning/10 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Monthly CTC (Already includes 20% Employer SSF)</p>
                  <p className="text-2xl font-bold">{formatNPR(totals.monthlyCTC)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <SalaryBreakdownDialog
        open={showBreakdown}
        onOpenChange={setShowBreakdown}
        employee={selectedEmployee}
        editable={isAdmin}
        onSaveOptions={handleSaveOptions}
      />
    </>
  );
}
