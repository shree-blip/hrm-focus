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
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Clock, AlertCircle, Calendar, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

interface Task {
  id: string;
  title: string;
  client: string;
  assignee: { name: string; initials: string };
  priority: "high" | "medium" | "low";
  dueDate: string;
  status: "todo" | "in-progress" | "review" | "done";
  timeEstimate: string;
}

interface TaskDetailDialogProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (task: Task) => void;
  onDelete: (taskId: string) => void;
}

export function TaskDetailDialog({
  task,
  open,
  onOpenChange,
  onUpdate,
  onDelete,
}: TaskDetailDialogProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTask, setEditedTask] = useState<Task | null>(null);

  if (!task) return null;

  const currentTask = editedTask || task;

  const handleSave = () => {
    if (editedTask) {
      onUpdate(editedTask);
      toast({
        title: "Task Updated",
        description: "Task has been updated successfully.",
      });
    }
    setIsEditing(false);
    setEditedTask(null);
  };

  const handleStatusChange = (newStatus: "todo" | "in-progress" | "review" | "done") => {
    const updated = { ...task, status: newStatus };
    onUpdate(updated);
    toast({
      title: "Status Updated",
      description: `Task moved to ${newStatus.replace("-", " ")}.`,
    });
  };

  const handleDelete = () => {
    onDelete(task.id);
    onOpenChange(false);
    toast({
      title: "Task Deleted",
      description: "Task has been removed.",
      variant: "destructive",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="font-display text-xl flex items-center gap-2">
            {isEditing ? (
              <Input
                value={editedTask?.title || task.title}
                onChange={(e) =>
                  setEditedTask({ ...(editedTask || task), title: e.target.value })
                }
                className="text-lg font-semibold"
              />
            ) : (
              task.title
            )}
          </DialogTitle>
          <DialogDescription>{task.client}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Status & Priority */}
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground mb-2 block">Status</Label>
              <Select
                value={currentTask.status}
                onValueChange={(v) => handleStatusChange(v as Task["status"])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">To Do</SelectItem>
                  <SelectItem value="in-progress">In Progress</SelectItem>
                  <SelectItem value="review">Review</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1">
              <Label className="text-xs text-muted-foreground mb-2 block">Priority</Label>
              <Badge
                variant="outline"
                className={cn(
                  "text-sm py-1 px-3",
                  currentTask.priority === "high" && "border-destructive/50 text-destructive",
                  currentTask.priority === "medium" && "border-warning/50 text-warning",
                  currentTask.priority === "low" && "border-muted-foreground/50"
                )}
              >
                {currentTask.priority}
              </Badge>
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 rounded-lg bg-secondary/50">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <User className="h-4 w-4" />
                <span className="text-xs">Assignee</span>
              </div>
              <div className="flex items-center gap-2">
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="bg-primary/10 text-primary text-xs">
                    {currentTask.assignee.initials}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium">{currentTask.assignee.name}</span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-secondary/50">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Calendar className="h-4 w-4" />
                <span className="text-xs">Due Date</span>
              </div>
              <span
                className={cn(
                  "text-sm font-medium flex items-center gap-1",
                  currentTask.dueDate === "Today" && "text-destructive"
                )}
              >
                {currentTask.dueDate === "Today" && <AlertCircle className="h-3 w-3" />}
                {currentTask.dueDate}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-secondary/50">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Clock className="h-4 w-4" />
                <span className="text-xs">Time Estimate</span>
              </div>
              <span className="text-sm font-medium">{currentTask.timeEstimate}</span>
            </div>

            <div className="p-3 rounded-lg bg-secondary/50">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <span className="text-xs">Client</span>
              </div>
              <span className="text-sm font-medium">{currentTask.client}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-between pt-4 border-t border-border">
            <Button variant="destructive" size="sm" onClick={handleDelete}>
              Delete Task
            </Button>
            <div className="flex gap-2">
              {isEditing ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsEditing(false);
                      setEditedTask(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSave}>
                    Save Changes
                  </Button>
                </>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditedTask(task);
                    setIsEditing(true);
                  }}
                >
                  Edit Task
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
