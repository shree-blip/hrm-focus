import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, User, AlertCircle } from "lucide-react";
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
}

interface EditEmployeeSalaryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: Employee | null;
  employees: Employee[];
  onSave: (employeeId: string, updates: Partial<Employee>) => void;
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

  // Validate numeric input - must be number, 0 allowed, no negatives
  const validateNumeric = (value: string): boolean => {
    if (value === "" || value === "0") return true;
    const num = parseFloat(value);
    return !isNaN(num) && num >= 0;
  };

  // Calculate net salary
  const calculateNetSalary = (): number => {
    const baseSalary = parseFloat(salary) || 0;
    const tax = parseFloat(incomeTax) || 0;
    const ss = parseFloat(socialSecurity) || 0;
    const pf = parseFloat(providentFund) || 0;
    return baseSalary - tax - ss - pf;
  };

  // Validate deductions don't exceed base salary
  const validateDeductions = (): boolean => {
    const baseSalary = parseFloat(salary) || 0;
    const totalDeductions = (parseFloat(incomeTax) || 0) + 
                           (parseFloat(socialSecurity) || 0) + 
                           (parseFloat(providentFund) || 0);
    return totalDeductions <= baseSalary;
  };

  const handleSave = () => {
    if (!employee) return;

    // Validate all numeric fields
    if (!validateNumeric(salary) || !validateNumeric(hourlyRate) || 
        !validateNumeric(incomeTax) || !validateNumeric(socialSecurity) || 
        !validateNumeric(providentFund)) {
      setValidationError("All values must be valid numbers (0 or positive)");
      toast({ title: "Validation Error", description: "All values must be valid numbers (0 or positive)", variant: "destructive" });
      return;
    }

    // Validate deductions don't exceed base salary
    if (payType === "salary" && !validateDeductions()) {
      setValidationError("Total deductions cannot exceed base salary");
      toast({ title: "Validation Error", description: "Total deductions cannot exceed base salary", variant: "destructive" });
      return;
    }

    const updates: Partial<Employee> = {
      pay_type: payType,
      salary: payType === "salary" ? (parseFloat(salary) || null) : null,
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

  // Filter out current employee from manager list
  const potentialManagers = employees.filter(e => e.id !== employee?.id);

  const netSalary = calculateNetSalary();
  const isDeductionsValid = validateDeductions();

  if (!employee) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Edit Compensation - {employee.first_name} {employee.last_name}
          </DialogTitle>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label>Pay Type</Label>
            <Select value={payType} onValueChange={setPayType}>
              <SelectTrigger>
                <SelectValue placeholder="Select pay type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="salary">Salary (Annual)</SelectItem>
                <SelectItem value="hourly">Hourly Rate</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {payType === "salary" ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="salary">Base Salary (Annual)</Label>
                <Input
                  id="salary"
                  type="number"
                  min="0"
                  placeholder="Enter annual salary"
                  value={salary}
                  onChange={(e) => {
                    setSalary(e.target.value);
                    setValidationError("");
                  }}
                />
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

              {/* Net Salary Display */}
              <div className="p-3 bg-muted rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Net Salary (Annual)</span>
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