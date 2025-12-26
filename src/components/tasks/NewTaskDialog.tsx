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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";

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
    assignee: { name: string; initials: string };
  }) => void;
  defaultStatus?: "todo" | "in-progress" | "review" | "done";
}

const assignees = [
  { name: "Sarah Johnson", initials: "SJ" },
  { name: "Michael Chen", initials: "MC" },
  { name: "Emily Davis", initials: "ED" },
  { name: "Lisa Park", initials: "LP" },
  { name: "James Wilson", initials: "JW" },
];

export function NewTaskDialog({
  open,
  onOpenChange,
  onSubmit,
  defaultStatus = "todo",
}: NewTaskDialogProps) {
  const [title, setTitle] = useState("");
  const [client, setClient] = useState("");
  const [priority, setPriority] = useState<"high" | "medium" | "low">("medium");
  const [dueDate, setDueDate] = useState("");
  const [timeEstimate, setTimeEstimate] = useState("");
  const [assignee, setAssignee] = useState("");
  const [status, setStatus] = useState<"todo" | "in-progress" | "review" | "done">(defaultStatus);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!title || !client || !dueDate || !timeEstimate || !assignee) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    const selectedAssignee = assignees.find((a) => a.name === assignee) || assignees[0];

    onSubmit({
      title,
      client,
      priority,
      dueDate,
      status,
      timeEstimate,
      assignee: selectedAssignee,
    });

    // Reset form
    setTitle("");
    setClient("");
    setPriority("medium");
    setDueDate("");
    setTimeEstimate("");
    setAssignee("");
    setStatus(defaultStatus);
    onOpenChange(false);

    toast({
      title: "Task Created",
      description: "New task has been added successfully.",
    });
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
            <Label htmlFor="title">Task Title</Label>
            <Input
              id="title"
              placeholder="Enter task title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
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
            <Select value={assignee} onValueChange={setAssignee}>
              <SelectTrigger>
                <SelectValue placeholder="Select assignee" />
              </SelectTrigger>
              <SelectContent>
                {assignees.map((a) => (
                  <SelectItem key={a.name} value={a.name}>
                    {a.name}
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
