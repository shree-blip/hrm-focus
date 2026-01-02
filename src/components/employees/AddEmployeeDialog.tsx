import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Manager {
  id: string;
  first_name: string;
  last_name: string;
  job_title: string | null;
}

interface AddEmployeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (employee: {
    name: string;
    email: string;
    role: string;
    department: string;
    location: string;
    status: string;
    initials: string;
    phone: string;
    managerId: string | null;
    lineManagerId: string | null;
  }) => void;
}

export function AddEmployeeDialog({
  open,
  onOpenChange,
  onAdd,
}: AddEmployeeDialogProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [department, setDepartment] = useState("");
  const [location, setLocation] = useState("");
  const [phone, setPhone] = useState("");
  const [managerId, setManagerId] = useState<string>("");
  const [assignLineManager, setAssignLineManager] = useState(false);
  const [lineManagerId, setLineManagerId] = useState<string>("");
  const [managers, setManagers] = useState<Manager[]>([]);
  const [lineManagers, setLineManagers] = useState<Manager[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      fetchManagers();
    }
  }, [open]);

  const fetchManagers = async () => {
    // Fetch managers (job_title contains 'Manager' or 'VP')
    const { data: managerData } = await supabase
      .from("employees")
      .select("id, first_name, last_name, job_title")
      .or("job_title.ilike.%manager%,job_title.ilike.%vp%,job_title.ilike.%vice president%")
      .eq("status", "active")
      .order("first_name", { ascending: true });

    if (managerData) {
      setManagers(managerData);
      // Filter for line managers specifically
      const lineManagerList = managerData.filter(m => 
        m.job_title?.toLowerCase().includes('line manager')
      );
      setLineManagers(lineManagerList.length > 0 ? lineManagerList : managerData);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (!name || !email || !role || !department || !location) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    // Check if email already exists
    const { data: existingEmployee } = await supabase
      .from("employees")
      .select("id")
      .eq("email", email.toLowerCase())
      .single();

    if (existingEmployee) {
      toast({
        title: "Email Already Exists",
        description: "An employee with this email already exists.",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    onAdd({
      name,
      email: email.toLowerCase(),
      role,
      department,
      location,
      status: "active",
      initials: getInitials(name),
      phone,
      managerId: managerId || null,
      lineManagerId: assignLineManager && lineManagerId ? lineManagerId : null,
    });

    // Reset form
    setName("");
    setEmail("");
    setRole("");
    setDepartment("");
    setLocation("");
    setPhone("");
    setManagerId("");
    setAssignLineManager(false);
    setLineManagerId("");
    setLoading(false);
    onOpenChange(false);

    toast({
      title: "Employee Added",
      description: `${name} has been added to the team. They can now sign up with their email.`,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Add New Employee</DialogTitle>
          <DialogDescription>
            Enter the details for the new employee. They will be able to sign up with their work email.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 col-span-2">
              <Label htmlFor="name">Full Name *</Label>
              <Input
                id="name"
                placeholder="Enter full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-2 col-span-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                placeholder="employee@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2 col-span-2">
              <Label htmlFor="role">Position / Title *</Label>
              <Input
                id="role"
                placeholder="e.g., Staff Accountant"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Department *</Label>
              <Select value={department} onValueChange={setDepartment}>
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
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
              <Label>Location *</Label>
              <Select value={location} onValueChange={setLocation}>
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="US">United States</SelectItem>
                  <SelectItem value="Nepal">Nepal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 col-span-2">
              <Label>Manager</Label>
              <Select value={managerId} onValueChange={setManagerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select manager (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {managers.map((manager) => (
                    <SelectItem key={manager.id} value={manager.id}>
                      {manager.first_name} {manager.last_name} - {manager.job_title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3 col-span-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="assign-line-manager">Assign a Line Manager</Label>
                <Switch
                  id="assign-line-manager"
                  checked={assignLineManager}
                  onCheckedChange={setAssignLineManager}
                />
              </div>
              
              {assignLineManager && (
                <Select value={lineManagerId} onValueChange={setLineManagerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select line manager" />
                  </SelectTrigger>
                  <SelectContent>
                    {lineManagers.map((lm) => (
                      <SelectItem key={lm.id} value={lm.id}>
                        {lm.first_name} {lm.last_name} - {lm.job_title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2 col-span-2">
              <Label htmlFor="phone">Phone (Optional)</Label>
              <Input
                id="phone"
                placeholder="+1 234 567 8900"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Adding..." : "Add Employee"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
