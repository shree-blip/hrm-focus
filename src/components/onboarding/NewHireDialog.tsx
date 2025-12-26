import { useState } from "react";
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
import { toast } from "@/hooks/use-toast";

interface NewHireDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (hire: {
    name: string;
    initials: string;
    role: string;
    department: string;
    startDate: string;
    progress: number;
    status: string;
    tasks: { name: string; completed: boolean }[];
  }) => void;
}

export function NewHireDialog({
  open,
  onOpenChange,
  onSubmit,
}: NewHireDialogProps) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [department, setDepartment] = useState("");
  const [startDate, setStartDate] = useState("");

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name || !role || !department || !startDate) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    onSubmit({
      name,
      initials: getInitials(name),
      role,
      department,
      startDate,
      progress: 0,
      status: "pending",
      tasks: [
        { name: "Send Offer Letter", completed: false },
        { name: "Background Check", completed: false },
        { name: "Sign NDA", completed: false },
        { name: "IT Setup Request", completed: false },
        { name: "Schedule Orientation", completed: false },
      ],
    });

    // Reset form
    setName("");
    setRole("");
    setDepartment("");
    setStartDate("");
    onOpenChange(false);

    toast({
      title: "New Hire Added",
      description: `${name} has been added to onboarding.`,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Add New Hire</DialogTitle>
          <DialogDescription>
            Enter details for the new employee to start onboarding.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              placeholder="Enter full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role / Position</Label>
            <Input
              id="role"
              placeholder="e.g., Staff Accountant"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Department</Label>
            <Select value={department} onValueChange={setDepartment}>
              <SelectTrigger>
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Executive">Executive</SelectItem>
                <SelectItem value="Accounting">Accounting</SelectItem>
                <SelectItem value="Tax">Tax</SelectItem>
                <SelectItem value="Operations">Operations</SelectItem>
                <SelectItem value="Marketing">Marketing</SelectItem>
                <SelectItem value="IT">IT</SelectItem>
                <SelectItem value="Focus Data">Focus Data</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="startDate">Start Date</Label>
            <Input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Add New Hire</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
