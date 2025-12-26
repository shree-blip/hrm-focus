import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, User } from "lucide-react";

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

  useEffect(() => {
    if (employee) {
      setSalary(employee.salary?.toString() || "");
      setHourlyRate(employee.hourly_rate?.toString() || "");
      setPayType(employee.pay_type || "salary");
      setManagerId(employee.manager_id || "none");
    }
  }, [employee]);

  const handleSave = () => {
    if (!employee) return;

    const updates: Partial<Employee> = {
      pay_type: payType,
      salary: payType === "salary" ? parseFloat(salary) || null : null,
      hourly_rate: payType === "hourly" ? parseFloat(hourlyRate) || null : null,
      manager_id: managerId === "none" ? null : managerId,
    };

    onSave(employee.id, updates);
    onOpenChange(false);
  };

  // Filter out current employee from manager list
  const potentialManagers = employees.filter(e => e.id !== employee?.id);

  if (!employee) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
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
            <div className="space-y-2">
              <Label htmlFor="salary">Annual Salary</Label>
              <Input
                id="salary"
                type="number"
                placeholder="Enter annual salary"
                value={salary}
                onChange={(e) => setSalary(e.target.value)}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="hourlyRate">Hourly Rate</Label>
              <Input
                id="hourlyRate"
                type="number"
                placeholder="Enter hourly rate"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
              />
            </div>
          )}

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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
