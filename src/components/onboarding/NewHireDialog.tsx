import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, UserPlus } from "lucide-react";

interface NewHireData {
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  department: string;
  startDate: string;
  location: string;
  phone?: string;
  salary?: number;
  payType?: string;
}

interface NewHireDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (hire: NewHireData) => Promise<any>;
}

const DEPARTMENTS = [
  "Executive",
  "Accounting",
  "Tax",
  "Operations",
  "Marketing",
  "IT",
  "Human Resources",
  "Sales",
  "Customer Support",
  "Finance",
  "Legal",
  "Engineering",
  "Product",
  "Design",
  "Focus Data",
];

export function NewHireDialog({ open, onOpenChange, onSubmit }: NewHireDialogProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("");
  const [department, setDepartment] = useState("");
  const [location, setLocation] = useState("");
  const [startDate, setStartDate] = useState("");
  const [salary, setSalary] = useState("");
  const [payType, setPayType] = useState("salary");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!firstName.trim()) {
      newErrors.firstName = "First name is required";
    }
    if (!lastName.trim()) {
      newErrors.lastName = "Last name is required";
    }
    if (!email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      newErrors.email = "Please enter a valid email address";
    }
    if (!role.trim()) {
      newErrors.role = "Job title is required";
    }
    if (!department) {
      newErrors.department = "Department is required";
    }
    if (!location) {
      newErrors.location = "Location is required";
    }
    if (!startDate) {
      newErrors.startDate = "Start date is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const resetForm = () => {
    setFirstName("");
    setLastName("");
    setEmail("");
    setPhone("");
    setRole("");
    setDepartment("");
    setLocation("");
    setStartDate("");
    setSalary("");
    setPayType("salary");
    setErrors({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await onSubmit({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim() || undefined,
        role: role.trim(),
        department,
        location,
        startDate,
        salary: salary ? parseFloat(salary) : undefined,
        payType,
      });

      // Only close and reset if successful (result is truthy)
      if (result) {
        resetForm();
        onOpenChange(false);
      }
    } catch (error) {
      console.error("Error submitting new hire:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      resetForm();
      onOpenChange(false);
    }
  };

  // Set minimum date to today
  const today = new Date().toISOString().split("T")[0];

  // Get salary label and placeholder based on pay type
  const getSalaryLabel = () => {
    if (payType === "hourly") return "Hourly Rate";
    if (payType === "contractor") return "Contract Rate";
    return "Annual Salary";
  };

  const getSalaryPlaceholder = () => {
    if (payType === "hourly") return "500";
    return "600000";
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="font-display text-xl flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Add New Hire
          </DialogTitle>
          <DialogDescription>
            Enter the new employee's details to start the onboarding process. An employee record will be created
            automatically.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {/* Name Row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">
                First Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="firstName"
                placeholder="John"
                value={firstName}
                onChange={(e) => {
                  setFirstName(e.target.value);
                  if (errors.firstName) setErrors((prev) => ({ ...prev, firstName: "" }));
                }}
                className={errors.firstName ? "border-destructive" : ""}
                disabled={isSubmitting}
              />
              {errors.firstName && <p className="text-xs text-destructive">{errors.firstName}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastName">
                Last Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="lastName"
                placeholder="Doe"
                value={lastName}
                onChange={(e) => {
                  setLastName(e.target.value);
                  if (errors.lastName) setErrors((prev) => ({ ...prev, lastName: "" }));
                }}
                className={errors.lastName ? "border-destructive" : ""}
                disabled={isSubmitting}
              />
              {errors.lastName && <p className="text-xs text-destructive">{errors.lastName}</p>}
            </div>
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email">
              Email Address <span className="text-destructive">*</span>
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="john.doe@company.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errors.email) setErrors((prev) => ({ ...prev, email: "" }));
              }}
              className={errors.email ? "border-destructive" : ""}
              disabled={isSubmitting}
            />
            {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="+977 98XXXXXXXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          {/* Role */}
          <div className="space-y-2">
            <Label htmlFor="role">
              Job Title / Role <span className="text-destructive">*</span>
            </Label>
            <Input
              id="role"
              placeholder="e.g., Software Engineer, Staff Accountant"
              value={role}
              onChange={(e) => {
                setRole(e.target.value);
                if (errors.role) setErrors((prev) => ({ ...prev, role: "" }));
              }}
              className={errors.role ? "border-destructive" : ""}
              disabled={isSubmitting}
            />
            {errors.role && <p className="text-xs text-destructive">{errors.role}</p>}
          </div>

          {/* Department, Location, and Start Date Row */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>
                Department <span className="text-destructive">*</span>
              </Label>
              <Select
                value={department}
                onValueChange={(value) => {
                  setDepartment(value);
                  if (errors.department) setErrors((prev) => ({ ...prev, department: "" }));
                }}
                disabled={isSubmitting}
              >
                <SelectTrigger className={errors.department ? "border-destructive" : ""}>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {DEPARTMENTS.map((dept) => (
                    <SelectItem key={dept} value={dept}>
                      {dept}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.department && <p className="text-xs text-destructive">{errors.department}</p>}
            </div>

            <div className="space-y-2">
              <Label>
                Location <span className="text-destructive">*</span>
              </Label>
              <Select
                value={location}
                onValueChange={(value) => {
                  setLocation(value);
                  if (errors.location) setErrors((prev) => ({ ...prev, location: "" }));
                }}
                disabled={isSubmitting}
              >
                <SelectTrigger className={errors.location ? "border-destructive" : ""}>
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="US">🇺🇸 United States</SelectItem>
                  <SelectItem value="Nepal">🇳🇵 Nepal</SelectItem>
                </SelectContent>
              </Select>
              {errors.location && <p className="text-xs text-destructive">{errors.location}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="startDate">
                Start Date <span className="text-destructive">*</span>
              </Label>
              <Input
                id="startDate"
                type="date"
                min={today}
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (errors.startDate) setErrors((prev) => ({ ...prev, startDate: "" }));
                }}
                className={errors.startDate ? "border-destructive" : ""}
                disabled={isSubmitting}
              />
              {errors.startDate && <p className="text-xs text-destructive">{errors.startDate}</p>}
            </div>
          </div>

          {/* Pay Type and Salary Row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Pay Type</Label>
              <Select value={payType} onValueChange={setPayType} disabled={isSubmitting}>
                <SelectTrigger>
                  <SelectValue placeholder="Select pay type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="salary">Salary</SelectItem>
                  <SelectItem value="hourly">Hourly</SelectItem>
                  <SelectItem value="contractor">Contractor</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="salary">{getSalaryLabel()} (NPR)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">
                  रू
                </span>
                <Input
                  id="salary"
                  type="number"
                  placeholder={getSalaryPlaceholder()}
                  value={salary}
                  onChange={(e) => setSalary(e.target.value)}
                  className="pl-8"
                  disabled={isSubmitting}
                  min="0"
                  step={payType === "hourly" ? "10" : "1000"}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {payType === "hourly" ? "Per hour rate in Nepali Rupees" : "Annual amount in Nepali Rupees"}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Add New Hire
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
