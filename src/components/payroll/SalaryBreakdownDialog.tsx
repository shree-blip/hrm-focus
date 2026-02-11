import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
import { calculateNepalPayroll, formatNPR, type NepalPayrollBreakdown } from "@/lib/nepalPayroll";
import { Calculator, TrendingDown, TrendingUp, Receipt, Percent, ShieldCheck } from "lucide-react";

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

  const Row = ({ label, value, bold, color }: { label: string; value: string; bold?: boolean; color?: string }) => (
    <div className={`flex justify-between items-center py-1.5 ${bold ? "font-semibold" : ""}`}>
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-sm ${color || "text-foreground"} ${bold ? "font-bold text-base" : ""}`}>{value}</span>
    </div>
  );

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
              <Badge variant="secondary" className="capitalize">{employee.gender}</Badge>
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
                value={insurance}
                onChange={(e) => setInsurance(e.target.value)}
                placeholder="0"
                className="h-8 text-sm"
              />
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

        {/* Gross Salary Section */}
        <div className="space-y-1">
          <h4 className="text-sm font-semibold flex items-center gap-1.5 text-primary">
            <TrendingUp className="h-4 w-4" /> Gross Salary
          </h4>
          <div className="pl-2 border-l-2 border-primary/20">
            <Row label="Monthly Gross Salary" value={formatNPR(breakdown.monthlyGross)} />
            <Row label="Basic Salary (60%)" value={formatNPR(breakdown.monthlyBasicSalary)} />
            <Row label="Allowance (40%)" value={formatNPR(breakdown.monthlyAllowance)} />
          </div>
        </div>

        <Separator />

        {/* Annual Assessment */}
        <div className="space-y-1">
          <h4 className="text-sm font-semibold flex items-center gap-1.5 text-primary">
            <Calculator className="h-4 w-4" /> Annual Assessment
          </h4>
          <div className="pl-2 border-l-2 border-primary/20">
            <Row label="Annual Gross (×12)" value={formatNPR(breakdown.annualGross)} />
            {includeDashain && <Row label="Dashain Bonus (1 month basic)" value={formatNPR(breakdown.dashainBonus)} />}
            <Row label="Annual Assessable Income" value={formatNPR(breakdown.annualAssessableIncome)} bold />
          </div>
        </div>

        <Separator />

        {/* SSF Section */}
        <div className="space-y-1">
          <h4 className="text-sm font-semibold flex items-center gap-1.5 text-primary">
            <ShieldCheck className="h-4 w-4" /> SSF Contribution
          </h4>
          <div className="pl-2 border-l-2 border-primary/20">
            <Row label="Employee SSF (11%)" value={formatNPR(breakdown.employeeSSF)} color="text-destructive" />
            <Row label="Employer SSF (20%)" value={formatNPR(breakdown.employerSSF)} color="text-muted-foreground" />
            <Row label="Total SSF (31%)" value={formatNPR(breakdown.totalSSF)} bold />
          </div>
        </div>

        <Separator />

        {/* Deductions & Taxable Income */}
        <div className="space-y-1">
          <h4 className="text-sm font-semibold flex items-center gap-1.5 text-primary">
            <TrendingDown className="h-4 w-4" /> Deductions & Tax
          </h4>
          <div className="pl-2 border-l-2 border-primary/20">
            <Row label="Employee SSF Deduction" value={`-${formatNPR(breakdown.employeeSSF)}`} color="text-destructive" />
            {breakdown.insuranceDeduction > 0 && (
              <Row label="Insurance Deduction" value={`-${formatNPR(breakdown.insuranceDeduction)}`} color="text-destructive" />
            )}
            <Row label="Taxable Income" value={formatNPR(breakdown.taxableIncome)} bold />
          </div>
        </div>

        <Separator />

        {/* TDS Calculation */}
        <div className="space-y-1">
          <h4 className="text-sm font-semibold flex items-center gap-1.5 text-primary">
            <Percent className="h-4 w-4" /> TDS Tax Calculation
          </h4>
          <div className="pl-2 border-l-2 border-primary/20">
            <Row label="Slab 1: 1% on first Rs. 5,00,000" value={formatNPR(breakdown.taxSlab1)} />
            {breakdown.taxSlab2 > 0 && (
              <Row label="Slab 2: 10% on excess" value={formatNPR(breakdown.taxSlab2)} />
            )}
            <Row label="Total TDS" value={formatNPR(breakdown.totalTDS)} />
            {breakdown.genderRebate > 0 && (
              <Row label="Gender Rebate (10% for female)" value={`-${formatNPR(breakdown.genderRebate)}`} color="text-success" />
            )}
            <Row label="Net TDS (Annual)" value={formatNPR(breakdown.netTDS)} bold color="text-destructive" />
          </div>
        </div>

        <Separator />

        {/* Monthly Final Breakdown */}
        <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 space-y-2">
          <h4 className="text-sm font-semibold text-primary">Monthly Salary Summary</h4>
          <Row label="Gross Salary" value={formatNPR(breakdown.monthlyGross)} />
          <Row label="SSF Deduction (11%)" value={`-${formatNPR(breakdown.monthlyEmployeeSSF)}`} color="text-destructive" />
          <Row label="Income Tax (TDS)" value={`-${formatNPR(breakdown.monthlyTDS)}`} color="text-destructive" />
          {breakdown.monthlyInsurance > 0 && (
            <Row label="Insurance" value={`-${formatNPR(breakdown.monthlyInsurance)}`} color="text-destructive" />
          )}
          <Separator />
          <Row label="Net Salary (Monthly)" value={formatNPR(breakdown.monthlyNetSalary)} bold color="text-success" />
          <Row label="Net Salary (Annual)" value={formatNPR(breakdown.annualNetSalary)} bold color="text-success" />
        </div>

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
