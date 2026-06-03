import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Cake, CalendarHeart } from "lucide-react";

interface Employee {
  id: number;
  name: string;
  email: string;
  role: string;
  department: string;
  location: string;
  status: string;
  initials: string;
  phone: string;
  profile_id?: string | null;
  user_id?: string | null;
}

interface EditEmployeeDialogProps {
  employee: Employee | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (employee: Employee) => void;
}

export function EditEmployeeDialog({
  employee,
  open,
  onOpenChange,
  onSave,
}: EditEmployeeDialogProps) {
  const [formData, setFormData] = useState<Employee | null>(null);
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [joiningDate, setJoiningDate] = useState("");
  const [savingMilestones, setSavingMilestones] = useState(false);

  useEffect(() => {
    if (employee) {
      setFormData({ ...employee });
    }
  }, [employee]);

  // Load existing milestone info (birthday / work anniversary) from the profile
  useEffect(() => {
    const fetchMilestones = async () => {
      setDateOfBirth("");
      setJoiningDate("");
      if (!open || !employee) return;
      let query = supabase.from("profiles").select("date_of_birth, joining_date").limit(1);
      if (employee.user_id) {
        query = query.eq("user_id", employee.user_id);
      } else if (employee.profile_id) {
        query = query.eq("id", employee.profile_id);
      } else {
        return;
      }
      const { data } = await query.maybeSingle();
      if (data) {
        setDateOfBirth(data.date_of_birth ?? "");
        setJoiningDate(data.joining_date ?? "");
      }
    };
    fetchMilestones();
  }, [open, employee?.user_id, employee?.profile_id]);

  if (!formData) return null;

  const handleSave = async () => {
    if (!formData.name || !formData.email) {
      toast.error("Name and email are required");
      return;
    }

    // Persist milestone info to the profile (if this employee has one linked)
    if (formData.user_id || formData.profile_id) {
      setSavingMilestones(true);
      const updates = {
        date_of_birth: dateOfBirth || null,
        joining_date: joiningDate || null,
      };
      let query = supabase.from("profiles").update(updates);
      query = formData.user_id
        ? query.eq("user_id", formData.user_id)
        : query.eq("id", formData.profile_id!);
      const { error } = await query;
      setSavingMilestones(false);
      if (error) {
        toast.error("Failed to save milestone info");
        return;
      }
    }

    onSave(formData);
    toast.success(`${formData.name}'s details updated successfully`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Edit Employee</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-1">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="Enter phone number"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Input
              id="role"
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="department">Department</Label>
              <Select
                value={formData.department}
                onValueChange={(value) => setFormData({ ...formData, department: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Executive">Executive</SelectItem>
                  <SelectItem value="Accounting">Accounting</SelectItem>
                  <SelectItem value="Tax">Tax</SelectItem>
                  <SelectItem value="Operations">Operations</SelectItem>
                  <SelectItem value="Marketing">Marketing</SelectItem>
                  <SelectItem value="IT">IT</SelectItem>
                  <SelectItem value="Healthcare">Healthcare</SelectItem>
                  <SelectItem value="Focus Data">Focus Data</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Select
                value={formData.location}
                onValueChange={(value) => setFormData({ ...formData, location: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="US">United States</SelectItem>
                  <SelectItem value="Nepal">Nepal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select
              value={formData.status}
              onValueChange={(value) => setFormData({ ...formData, status: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="probation">Probation</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-3 rounded-lg border p-4">
            <p className="text-sm font-medium">Milestones</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dateOfBirth" className="flex items-center gap-1.5">
                  <Cake className="h-3.5 w-3.5 text-muted-foreground" />
                  Birthday
                </Label>
                <Input
                  id="dateOfBirth"
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="joiningDate" className="flex items-center gap-1.5">
                  <CalendarHeart className="h-3.5 w-3.5 text-muted-foreground" />
                  Work Anniversary
                </Label>
                <Input
                  id="joiningDate"
                  type="date"
                  value={joiningDate}
                  onChange={(e) => setJoiningDate(e.target.value)}
                />
              </div>
            </div>
            {!formData.user_id && !formData.profile_id && (
              <p className="text-xs text-muted-foreground">
                This employee hasn't signed up yet, so milestone info can't be saved until their profile is created.
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={savingMilestones}>
            {savingMilestones ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
