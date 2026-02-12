import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
import { calculateNepalPayroll, formatNPR, type NepalPayrollBreakdown } from "@/lib/nepalPayroll";
import { Calculator, TrendingDown, TrendingUp, Receipt, Percent, ShieldCheck, Info, Building2 } from "lucide-react";

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  salary: number | null;
  gender?: string | null;
  insurance_premium?: number | null;
  include_dashain_bonus?: boolean | null;
  department?: string | null;
  job_title?: string | null;
}

interface SalaryBreakdownDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: Employee | null;
  editable?: boolean;
  onSaveOptions?: (employeeId: string, updates: { insurance_premium: number; include_dashain_bonus: boolean }) => void;
}

export function SalaryBreakdownDialog({
  open,
  onOpenChange,
  employee,
  editable = false,
  onSaveOptions,
}: SalaryBreakdownDialogProps) {
  const [includeDashain, setIncludeDashain] = useState(false);
  const [insurance, setInsurance] = useState("0");
  const [breakdown, setBreakdown] = useState<NepalPayrollBreakdown | null>(null);

  useEffect(() => {
    if (employee) {
      setIncludeDashain(employee.include_dashain_bonus ?? false);
      setInsurance(employee.insurance_premium?.toString() || "0");
    }
  }, [employee]);

  useEffect(() => {
    if (!employee?.salary) {
      setBreakdown(null);
      return;
    }
    const result = calculateNepalPayroll({
      annualSalary: employee.salary,
      gender: (employee.gender as "male" | "female") || null,
      insurancePremium: parseFloat(insurance) || 0,
      includeDashainBonus: includeDashain,
    });
    setBreakdown(result);
  }, [employee, includeDashain, insurance]);

  const handleSave = () => {
    if (employee && onSaveOptions) {
      onSaveOptions(employee.id, {
        insurance_premium: parseFloat(insurance) || 0,
        include_dashain_bonus: includeDashain,
      });
    }
  };

  if (!employee || !breakdown) return null;

  const Row = ({
    label,
    value,
    bold,
    color,
    small,
  }: {
    label: string;
    value: string;
    bold?: boolean;
    color?: string;
    small?: boolean;
  }) => (
    <div className={`flex justify-between items-center py-1.5 ${bold ? "font-semibold" : ""}`}>
      <span className={`${small ? "text-xs" : "text-sm"} text-muted-foreground`}>{label}</span>
      <span
        className={`${small ? "text-xs" : "text-sm"} ${color || "text-foreground"} ${bold ? "font-bold text-base" : ""}`}
      >
        {value}
      </span>
    </div>
  );

  const hasTDS = breakdown.taxableAboveExemption > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            Salary Breakdown — {employee.first_name} {employee.last_name}
          </DialogTitle>
          <div className="flex gap-2 mt-1">
            {employee.department && <Badge variant="outline">{employee.department}</Badge>}
            {employee.gender && (
              <Badge variant="secondary" className="capitalize">
                {employee.gender}
              </Badge>
            )}
          </div>
        </DialogHeader>

        {/* Optional inputs */}
        {editable && (
          <div className="grid grid-cols-2 gap-4 p-3 bg-muted/50 rounded-lg">
            <div className="space-y-1.5">
              <Label className="text-xs">Insurance Premium (Annual)</Label>
              <Input
                type="number"
                min="0"
                max="40000"
                value={insurance}
                onChange={(e) => setInsurance(e.target.value)}
                placeholder="0"
                className="h-8 text-sm"
              />
              <span className="text-[10px] text-muted-foreground">Max deductible: Rs. 40,000</span>
            </div>

            <div className="flex items-end gap-2 pb-1">
              <div className="space-y-1.5">
                <Label className="text-xs">Dashain Bonus</Label>
                <div className="flex items-center gap-2">
                  <Switch checked={includeDashain} onCheckedChange={setIncludeDashain} />
                  <span className="text-xs text-muted-foreground">{includeDashain ? "Included" : "Excluded"}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CTC Breakdown Section */}
        <div className="space-y-1">
          <h4 className="text-sm font-semibold flex items-center gap-1.5 text-primary">
            <Building2 className="h-4 w-4" /> CTC Breakdown (Company Pays)
          </h4>
          <div className="pl-2 border-l-2 border-primary/20">
            <Row label="Monthly CTC (incl. Employer SSF)" value={formatNPR(breakdown.monthlyCTC)} bold />
            <Row label="├ Employee Gross Salary" value={formatNPR(breakdown.monthlyGross)} />
            <Row
              label="└ Employer SSF (20% of Basic)"
              value={formatNPR(breakdown.monthlyEmployerSSF)}
              color="text-info"
              small
            />
          </div>
          <div className="flex items-start gap-1.5 p-2 bg-muted/50 rounded text-xs text-muted-foreground mt-2">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>CTC = Gross + Employer SSF. The salary you entered includes employer's 20% SSF contribution.</span>
          </div>
        </div>

        <Separator />

        {/* Gross Salary Section */}
        <div className="space-y-1">
          <h4 className="text-sm font-semibold flex items-center gap-1.5 text-primary">
            <TrendingUp className="h-4 w-4" /> Employee Gross Salary
          </h4>
          <div className="pl-2 border-l-2 border-primary/20">
            <Row label="Monthly Gross Salary" value={formatNPR(breakdown.monthlyGross)} />
            <Row label="├ Basic Salary (60%)" value={formatNPR(breakdown.monthlyBasicSalary)} small />
            <Row label="└ Allowance (40%)" value={formatNPR(breakdown.monthlyAllowance)} small />
          </div>
        </div>

        <Separator />

        {/* Annual Assessment */}
        <div className="space-y-1">
          <h4 className="text-sm font-semibold flex items-center gap-1.5 text-primary">
            <Calculator className="h-4 w-4" /> Annual Assessment
          </h4>
          <div className="pl-2 border-l-2 border-primary/20">
            <Row label="Annual CTC (×12)" value={formatNPR(breakdown.annualCTC)} />
            {includeDashain && (
              <Row
                label="+ Dashain Bonus (1 month basic)"
                value={formatNPR(breakdown.dashainBonus)}
                color="text-info"
              />
            )}
            <Row label="Assessable Income" value={formatNPR(breakdown.annualAssessableIncome)} bold />
          </div>
        </div>

        <Separator />

        {/* SSF Section */}
        <div className="space-y-1">
          <h4 className="text-sm font-semibold flex items-center gap-1.5 text-primary">
            <ShieldCheck className="h-4 w-4" /> SSF Contribution
          </h4>
          <div className="pl-2 border-l-2 border-primary/20">
            <Row
              label="Employee SSF (11% of Basic)"
              value={formatNPR(breakdown.employeeSSF)}
              color="text-destructive"
            />
            <Row
              label="Employer SSF (20% of Basic)"
              value={formatNPR(breakdown.employerSSF)}
              color="text-muted-foreground"
            />
            <Row label="Total SSF (31%)" value={formatNPR(breakdown.totalSSF)} bold />
          </div>
          <div className="flex items-start gap-1.5 p-2 bg-info/10 rounded text-xs text-info mt-2">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>SSF covers the 1% Social Security Tax on first Rs. 5 Lakh. This is NOT added to TDS.</span>
          </div>
        </div>

        <Separator />

        {/* Deductions & Taxable Income */}
        <div className="space-y-1">
          <h4 className="text-sm font-semibold flex items-center gap-1.5 text-primary">
            <TrendingDown className="h-4 w-4" /> Deductions & Taxable Income
          </h4>
          <div className="pl-2 border-l-2 border-primary/20">
            <Row label="Assessable Income" value={formatNPR(breakdown.annualAssessableIncome)} />
            <Row label="− Total SSF (31%)" value={`-${formatNPR(breakdown.totalSSF)}`} color="text-destructive" />
            {breakdown.insuranceDeduction > 0 && (
              <Row
                label="− Insurance Deduction"
                value={`-${formatNPR(breakdown.insuranceDeduction)}`}
                color="text-destructive"
              />
            )}
            <Row label="Taxable Income" value={formatNPR(breakdown.taxableIncome)} bold />
          </div>
        </div>

        <Separator />

        {/* TDS Calculation */}
        <div className="space-y-1">
          <h4 className="text-sm font-semibold flex items-center gap-1.5 text-primary">
            <Percent className="h-4 w-4" /> TDS (Income Tax) Calculation
          </h4>
          <div className="pl-2 border-l-2 border-primary/20">
            <Row
              label="Tax-Exempt Amount (SSF covers 1%)"
              value={formatNPR(breakdown.taxExemptAmount)}
              color="text-success"
            />

            {hasTDS ? (
              <>
                <Row
                  label="Taxable Above Rs. 5 Lakh"
                  value={formatNPR(breakdown.taxableAboveExemption)}
                  color="text-warning"
                />

                <div className="mt-2 mb-1 text-xs font-medium text-muted-foreground">Tax Slabs Applied:</div>

                {breakdown.taxSlab1 > 0 && (
                  <Row
                    label="Slab 1: 10% (Rs. 5L - 7L)"
                    value={formatNPR(breakdown.taxSlab1)}
                    small
                    color="text-destructive"
                  />
                )}
                {breakdown.taxSlab2 > 0 && (
                  <Row
                    label="Slab 2: 20% (Rs. 7L - 10L)"
                    value={formatNPR(breakdown.taxSlab2)}
                    small
                    color="text-destructive"
                  />
                )}
                {breakdown.taxSlab3 > 0 && (
                  <Row
                    label="Slab 3: 30% (Rs. 10L - 20L)"
                    value={formatNPR(breakdown.taxSlab3)}
                    small
                    color="text-destructive"
                  />
                )}
                {breakdown.taxSlab4 > 0 && (
                  <Row
                    label="Slab 4: 36% (Rs. 20L - 50L)"
                    value={formatNPR(breakdown.taxSlab4)}
                    small
                    color="text-destructive"
                  />
                )}
                {breakdown.taxSlab5 > 0 && (
                  <Row
                    label="Slab 5: 39% (Above Rs. 50L)"
                    value={formatNPR(breakdown.taxSlab5)}
                    small
                    color="text-destructive"
                  />
                )}

                <Row label="Total TDS" value={formatNPR(breakdown.totalTDS)} />

                {breakdown.genderRebate > 0 && (
                  <Row
                    label="− Female Rebate (10%)"
                    value={`-${formatNPR(breakdown.genderRebate)}`}
                    color="text-success"
                  />
                )}

                <Row label="Net TDS (Annual)" value={formatNPR(breakdown.netTDS)} bold color="text-destructive" />
              </>
            ) : (
              <div className="flex items-center gap-1.5 p-2 bg-success/10 rounded text-xs text-success mt-2">
                <Info className="h-3.5 w-3.5 shrink-0" />
                <span>Taxable income is below Rs. 5 Lakh. No TDS applicable!</span>
              </div>
            )}
          </div>
        </div>

        <Separator />

        {/* Monthly Final Breakdown */}
        <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 space-y-2">
          <h4 className="text-sm font-semibold text-primary">Monthly Salary Summary (Regular Month)</h4>
          <Row label="Gross Salary (Employee)" value={formatNPR(breakdown.monthlyGross)} />
          <Row
            label="− SSF Deduction (11%)"
            value={`-${formatNPR(breakdown.monthlyEmployeeSSF)}`}
            color="text-destructive"
          />
          <Row label="− Income Tax (TDS)" value={`-${formatNPR(breakdown.monthlyTDS)}`} color="text-destructive" />
          <Separator className="my-2" />
          <Row label="Net Salary (Monthly)" value={formatNPR(breakdown.monthlyNetSalary)} bold color="text-success" />
          <Row label="Net Salary (Annual)" value={formatNPR(breakdown.annualNetSalary)} bold color="text-success" />
        </div>

        {/* Dashain Month Payout (one-time) */}
        {includeDashain && breakdown.dashainBonus > 0 && (
          <div className="mt-3 p-4 rounded-lg bg-warning/10 border border-warning/20 space-y-2">
            <h4 className="text-sm font-semibold text-warning">Dashain Month (One-time)</h4>
            <Row
              label="+ Dashain Bonus (1 month basic)"
              value={formatNPR(breakdown.dashainBonus)}
              bold
              color="text-info"
            />
            <Separator className="my-2" />
            <Row
              label="Net Salary (Dashain Month)"
              value={formatNPR(breakdown.dashainMonthNetSalary)}
              bold
              color="text-success"
            />
          </div>
        )}

        {editable && onSaveOptions && (
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Save Options
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
