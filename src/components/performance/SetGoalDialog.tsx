import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { CreateGoalInput } from "@/hooks/usePerformanceReviews";

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employees: Employee[];
  onSubmit: (input: CreateGoalInput) => Promise<void>;
  /** If provided, pre-selects the employee (e.g. when manager sets goal for a specific report) */
  preselectedEmployeeId?: string;
}

export function SetGoalDialog({ open, onOpenChange, employees, onSubmit, preselectedEmployeeId }: Props) {
  const [employeeId, setEmployeeId] = useState(preselectedEmployeeId || "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = employeeId && title.trim();

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    await onSubmit({
      employee_id: employeeId,
      title: title.trim(),
      description: description.trim() || undefined,
      target_date: targetDate || undefined,
    });
    setSubmitting(false);
    resetForm();
    onOpenChange(false);
  }

  function resetForm() {
    setEmployeeId(preselectedEmployeeId || "");
    setTitle("");
    setDescription("");
    setTargetDate("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Set Performance Goal</DialogTitle>
          <DialogDescription>Create a measurable goal for an employee to track.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>Employee</Label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
              <SelectContent>
                {employees.map(e => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.first_name} {e.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Goal Title</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Complete project X" />
          </div>

          <div className="space-y-1">
            <Label>Description (optional)</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Details about the goal..." />
          </div>

          <div className="space-y-1">
            <Label>Target Date (optional)</Label>
            <input
              type="date"
              value={targetDate}
              onChange={e => setTargetDate(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || submitting}>Create Goal</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
