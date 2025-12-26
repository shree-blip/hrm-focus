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
import { toast } from "@/hooks/use-toast";
import { useEmployees } from "@/hooks/useEmployees";
import { useAuth } from "@/contexts/AuthContext";

interface NewTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (task: {
    title: string;
    client: string;
    priority: "high" | "medium" | "low";
    dueDate: string;
    status: "todo" | "in-progress" | "review" | "done";
    timeEstimate: string;
    assigneeId: string | null;
  }) => void;
  defaultStatus?: "todo" | "in-progress" | "review" | "done";
}

export function NewTaskDialog({
  open,
  onOpenChange,
  onSubmit,
  defaultStatus = "todo",
}: NewTaskDialogProps) {
  const { employees, loading: employeesLoading } = useEmployees();
  const { user, profile } = useAuth();
  
  const [title, setTitle] = useState("");
  const [client, setClient] = useState("");
  const [priority, setPriority] = useState<"high" | "medium" | "low">("medium");
  const [dueDate, setDueDate] = useState("");
  const [timeEstimate, setTimeEstimate] = useState("");
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [status, setStatus] = useState<"todo" | "in-progress" | "review" | "done">(defaultStatus);

  // Reset status when defaultStatus changes
  useEffect(() => {
    setStatus(defaultStatus);
  }, [defaultStatus]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!title) {
      toast({
        title: "Missing Information",
        description: "Please enter a task title.",
        variant: "destructive",
      });
      return;
    }

    onSubmit({
      title,
      client: client || undefined,
      priority,
      dueDate,
      status,
      timeEstimate: timeEstimate || undefined,
      assigneeId: assigneeId || null,
    });

    // Reset form
    setTitle("");
    setClient("");
    setPriority("medium");
    setDueDate("");
    setTimeEstimate("");
    setAssigneeId("");
    setStatus(defaultStatus);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Create New Task</DialogTitle>
          <DialogDescription>
            Add a new task to the board.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="title">Task Title <span className="text-destructive">*</span></Label>
            <Input
              id="title"
              placeholder="Enter task title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="client">Client</Label>
            <Input
              id="client"
              placeholder="Client name or Internal"
              value={client}
              onChange={(e) => setClient(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as "high" | "medium" | "low")}>
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as "todo" | "in-progress" | "review" | "done")}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">To Do</SelectItem>
                  <SelectItem value="in-progress">In Progress</SelectItem>
                  <SelectItem value="review">Review</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dueDate">Due Date</Label>
              <Input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="timeEstimate">Time Estimate</Label>
              <Input
                id="timeEstimate"
                placeholder="e.g., 4h"
                value={timeEstimate}
                onChange={(e) => setTimeEstimate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Assignee</Label>
            <Select value={assigneeId} onValueChange={setAssigneeId}>
              <SelectTrigger>
                <SelectValue placeholder={employeesLoading ? "Loading..." : "Select assignee"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {/* Show current user first if profile exists */}
                {profile && user && (
                  <SelectItem key={user.id} value={user.id}>
                    {profile.first_name} {profile.last_name} (Me)
                  </SelectItem>
                )}
                {/* Show other employees */}
                {employees
                  .filter(emp => emp.profile_id !== profile?.id)
                  .map((emp) => (
                    <SelectItem key={emp.id} value={emp.profile_id || emp.id}>
                      {emp.first_name} {emp.last_name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Create Task</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}