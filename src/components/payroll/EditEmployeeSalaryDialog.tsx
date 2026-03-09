import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, User, AlertCircle, Info } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  salary: number | null;
  hourly_rate: number | null;
  pay_type: string | null;
  manager_id: string | null;
  department: string | null;
  job_title: string | null;
  income_tax: number | null;
  social_security: number | null;
  provident_fund: number | null;
  gender?: string | null;
  insurance_premium?: number | null;
  include_dashain_bonus?: boolean | null;
  hire_date?: string | null;
}

interface EditEmployeeSalaryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: Employee | null;
  employees: Employee[];
  onSave: (employeeId: string, updates: Partial<Employee>) => void;
}

/**
 * Calculate pro-rated months from hire date to end of fiscal year (Dec 31).
 * Returns a value between 1 and 12.
 */
function getProRatedMonths(hireDate: string | null | undefined): number {
  if (!hireDate) return 12;
  const hire = new Date(hireDate);
  const hireMonth = hire.getMonth(); // 0-indexed (Jan=0)
  // Months remaining from hire month to December (inclusive)
  const months = 12 - hireMonth;
  return Math.max(1, Math.min(12, months));
}

export function EditEmployeeSalaryDialog({ 
  open, 
  onOpenChange, 
  employee, 
  employees,
  onSave 
}: EditEmployeeSalaryDialogProps) {
  const [salary, setSalary] = useState<string>("");
  const [hourlyRate, setHourlyRate] = useState<string>("");
  const [payType, setPayType] = useState<string>("salary");
  const [managerId, setManagerId] = useState<string>("");
  const [incomeTax, setIncomeTax] = useState<string>("");
  const [socialSecurity, setSocialSecurity] = useState<string>("");
  const [providentFund, setProvidentFund] = useState<string>("");
  const [validationError, setValidationError] = useState<string>("");
  const [gender, setGender] = useState<string>("");
  const [insurancePremium, setInsurancePremium] = useState<string>("0");
  const [includeDashain, setIncludeDashain] = useState(false);

  useEffect(() => {
    if (employee) {
      setSalary(employee.salary?.toString() || "");
      setHourlyRate(employee.hourly_rate?.toString() || "");
      setPayType(employee.pay_type || "salary");
      setManagerId(employee.manager_id || "none");
      setIncomeTax(employee.income_tax?.toString() || "0");
      setSocialSecurity(employee.social_security?.toString() || "0");
      setProvidentFund(employee.provident_fund?.toString() || "0");
      setGender(employee.gender || "");
      setInsurancePremium(employee.insurance_premium?.toString() || "0");
      setIncludeDashain(employee.include_dashain_bonus ?? false);
      setValidationError("");
    }
  }, [employee]);

  const validateNumeric = (value: string): boolean => {
    if (value === "" || value === "0") return true;
    const num = parseFloat(value);
    return !isNaN(num) && num >= 0;
  };

  // Pro-rated months calculation
  const proRatedMonths = useMemo(() => getProRatedMonths(employee?.hire_date), [employee?.hire_date]);
  const proRateRatio = proRatedMonths / 12;

  // Auto-calculate deductions for salary types based on join date
  const autoCalculations = useMemo(() => {
    if (payType === "hourly") return null;
    const annualSalary = parseFloat(salary) || 0;
    if (annualSalary <= 0) return null;

    // For "monthly" pay type, the salary input is monthly — convert to annual for calculations
    const effectiveAnnualSalary = payType === "monthly" ? annualSalary * 12 : annualSalary;

    // Pro-rated annual income based on join date
    const proRatedAnnualIncome = effectiveAnnualSalary * proRateRatio;

    // Income Tax (pro-rated): using Nepal slab-based approach
    // Simplified: 1% on first 5L, 10% on next 2L, 20% on next 3L
    let calcTax = 0;
    const taxable = proRatedAnnualIncome;
    if (taxable > 500000) {
      const above5L = Math.min(taxable - 500000, 200000);
      calcTax += above5L * 0.10;
    }
    if (taxable > 700000) {
      const above7L = Math.min(taxable - 700000, 300000);
      calcTax += above7L * 0.20;
    }
    if (taxable > 1000000) {
      const above10L = Math.min(taxable - 1000000, 1000000);
      calcTax += above10L * 0.30;
    }
    if (taxable > 2000000) {
      calcTax += (taxable - 2000000) * 0.36;
    }
    // Female rebate
    if (gender === "female") {
      calcTax = calcTax * 0.9;
    }

    // Social Security: 11% of basic (60% of gross), pro-rated
    const grossMonthly = (effectiveAnnualSalary / 1.12) / 12;
    const basicMonthly = grossMonthly * 0.6;
    const calcSS = basicMonthly * 0.11 * proRatedMonths;

    // Provident Fund: 10% of basic, pro-rated from join to December
    const calcPF = basicMonthly * 0.10 * proRatedMonths;

    return {
      incomeTax: Math.round(calcTax),
      socialSecurity: Math.round(calcSS),
      providentFund: Math.round(calcPF),
      proRatedAnnualIncome: Math.round(proRatedAnnualIncome),
    };
  }, [salary, payType, proRateRatio, proRatedMonths, gender]);

  const calculateNetSalary = (): number => {
    const baseSalary = parseFloat(salary) || 0;
    const tax = parseFloat(incomeTax) || 0;
    const ss = parseFloat(socialSecurity) || 0;
    const pf = parseFloat(providentFund) || 0;
    return baseSalary - tax - ss - pf;
  };

  const validateDeductions = (): boolean => {
    const baseSalary = parseFloat(salary) || 0;
    const totalDeductions = (parseFloat(incomeTax) || 0) + 
                           (parseFloat(socialSecurity) || 0) + 
                           (parseFloat(providentFund) || 0);
    return totalDeductions <= baseSalary;
  };

  const handleApplyAutoCalc = () => {
    if (autoCalculations) {
      setIncomeTax(autoCalculations.incomeTax.toString());
      setSocialSecurity(autoCalculations.socialSecurity.toString());
      setProvidentFund(autoCalculations.providentFund.toString());
      toast({ title: "Auto-Calculated", description: `Pro-rated for ${proRatedMonths} months based on join date` });
    }
  };

  const handleSave = () => {
    if (!employee) return;

    if (!validateNumeric(salary) || !validateNumeric(hourlyRate) || 
        !validateNumeric(incomeTax) || !validateNumeric(socialSecurity) || 
        !validateNumeric(providentFund)) {
      setValidationError("All values must be valid numbers (0 or positive)");
      toast({ title: "Validation Error", description: "All values must be valid numbers (0 or positive)", variant: "destructive" });
      return;
    }

    if ((payType === "salary" || payType === "monthly") && !validateDeductions()) {
      setValidationError("Total deductions cannot exceed base salary");
      toast({ title: "Validation Error", description: "Total deductions cannot exceed base salary", variant: "destructive" });
      return;
    }

    const salaryValue = parseFloat(salary) || null;

    const updates: Partial<Employee> = {
      pay_type: payType,
      salary: (payType === "salary" || payType === "monthly") ? salaryValue : null,
      hourly_rate: payType === "hourly" ? (parseFloat(hourlyRate) || null) : null,
      manager_id: managerId === "none" ? null : managerId,
      income_tax: parseFloat(incomeTax) || 0,
      social_security: parseFloat(socialSecurity) || 0,
      provident_fund: parseFloat(providentFund) || 0,
      gender: gender || null,
      insurance_premium: parseFloat(insurancePremium) || 0,
      include_dashain_bonus: includeDashain,
    };

    onSave(employee.id, updates);
    onOpenChange(false);
    setValidationError("");
  };

  const potentialManagers = employees.filter(e => e.id !== employee?.id);

  const netSalary = calculateNetSalary();
  const isDeductionsValid = validateDeductions();

  if (!employee) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Edit Compensation - {employee.first_name} {employee.last_name}
          </DialogTitle>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          {/* Join date info */}
          {employee.hire_date && (
            <div className="flex items-start gap-2 p-2.5 bg-info/10 border border-info/20 rounded-lg text-xs text-info">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>
                Joined: <strong>{new Date(employee.hire_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</strong>
                {proRatedMonths < 12 && ` — Pro-rated to ${proRatedMonths} months for tax/SSF/PF calculations`}
              </span>
            </div>
          )}

          <div className="space-y-2">
            <Label>Pay Type</Label>
            <Select value={payType} onValueChange={setPayType}>
              <SelectTrigger>
                <SelectValue placeholder="Select pay type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="salary">Salary (Annual)</SelectItem>
                <SelectItem value="monthly">Salary (Monthly)</SelectItem>
                <SelectItem value="hourly">Hourly Rate</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {payType === "salary" || payType === "monthly" ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="salary">
                  {payType === "monthly" ? "Monthly Salary" : "Base Salary (Annual)"}
                </Label>
                <Input
                  id="salary"
                  type="number"
                  min="0"
                  placeholder={payType === "monthly" ? "Enter monthly salary" : "Enter annual salary"}
                  value={salary}
                  onChange={(e) => {
                    setSalary(e.target.value);
                    setValidationError("");
                  }}
                />
                {payType === "monthly" && salary && (
                  <p className="text-xs text-muted-foreground">
                    Annual equivalent: Rs. {((parseFloat(salary) || 0) * 12).toLocaleString()}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="incomeTax">Income Tax</Label>
                  <Input
                    id="incomeTax"
                    type="number"
                    min="0"
                    placeholder="0"
                    value={incomeTax}
                    onChange={(e) => {
                      setIncomeTax(e.target.value);
                      setValidationError("");
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="socialSecurity">Social Security</Label>
                  <Input
                    id="socialSecurity"
                    type="number"
                    min="0"
                    placeholder="0"
                    value={socialSecurity}
                    onChange={(e) => {
                      setSocialSecurity(e.target.value);
                      setValidationError("");
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="providentFund">Provident Fund</Label>
                  <Input
                    id="providentFund"
                    type="number"
                    min="0"
                    placeholder="0"
                    value={providentFund}
                    onChange={(e) => {
                      setProvidentFund(e.target.value);
                      setValidationError("");
                    }}
                  />
                </div>
              </div>

              {/* Auto-calculate button */}
              {autoCalculations && (
                <div className="p-3 bg-secondary/50 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">
                      Auto-calculated (pro-rated {proRatedMonths}/12 months)
                    </span>
                    <Button size="sm" variant="outline" onClick={handleApplyAutoCalc} className="h-7 text-xs">
                      Apply
                    </Button>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Tax: </span>
                      <span className="font-medium">Rs. {autoCalculations.incomeTax.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">SSF: </span>
                      <span className="font-medium">Rs. {autoCalculations.socialSecurity.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">PF: </span>
                      <span className="font-medium">Rs. {autoCalculations.providentFund.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Net Salary Display */}
              <div className="p-3 bg-muted rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    Net Salary ({payType === "monthly" ? "Monthly" : "Annual"})
                  </span>
                  <span className={`text-lg font-bold ${!isDeductionsValid ? 'text-destructive' : 'text-foreground'}`}>
                    {netSalary.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                </div>
                {!isDeductionsValid && (
                  <div className="flex items-center gap-1 text-destructive text-xs mt-1">
                    <AlertCircle className="h-3 w-3" />
                    Deductions exceed base salary
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="hourlyRate">Hourly Rate</Label>
              <Input
                id="hourlyRate"
                type="number"
                min="0"
                placeholder="Enter hourly rate"
                value={hourlyRate}
                onChange={(e) => {
                  setHourlyRate(e.target.value);
                  setValidationError("");
                }}
              />
            </div>
          )}

          {/* Nepal-specific fields */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Gender</Label>
              <Select value={gender || "unset"} onValueChange={(v) => setGender(v === "unset" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unset">Not Set</SelectItem>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Insurance (Annual)</Label>
              <Input
                type="number"
                min="0"
                value={insurancePremium}
                onChange={(e) => setInsurancePremium(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-2 flex flex-col justify-end">
              <Label className="text-xs">Dashain Bonus</Label>
              <div className="flex items-center gap-2 h-10">
                <input
                  type="checkbox"
                  checked={includeDashain}
                  onChange={(e) => setIncludeDashain(e.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                <span className="text-sm text-muted-foreground">Include</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Line Manager
            </Label>
            <Select value={managerId} onValueChange={setManagerId}>
              <SelectTrigger>
                <SelectValue placeholder="Select manager" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Manager</SelectItem>
                {potentialManagers.map((mgr) => (
                  <SelectItem key={mgr.id} value={mgr.id}>
                    {mgr.first_name} {mgr.last_name} - {mgr.job_title || "Employee"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {validationError && (
            <div className="flex items-center gap-2 text-destructive text-sm">
              <AlertCircle className="h-4 w-4" />
              {validationError}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!isDeductionsValid}>
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
