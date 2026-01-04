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
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Clock, AlertCircle, Calendar, User, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { useEmployees } from "@/hooks/useEmployees";
import { useAuth } from "@/contexts/AuthContext";

interface TaskAssignee {
  user_id: string;
  assigned_by: string;
  assigned_at: string;
  assignee_name?: string;
  assigner_name?: string;
}

interface Task {
  id: string;
  title: string;
  client: string;
  priority: "high" | "medium" | "low";
  dueDate: string;
  status: "todo" | "in-progress" | "review" | "done";
  timeEstimate: string;
  created_by?: string;
  created_by_name?: string;
  assignees?: TaskAssignee[];
}

interface TaskDetailDialogProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onUpdateAssignees?: (taskId: string, assigneeIds: string[]) => void;
}

export function TaskDetailDialog({
  task,
  open,
  onOpenChange,
  onUpdate,
  onDelete,
  onUpdateAssignees,
}: TaskDetailDialogProps) {
  const { employees } = useEmployees();
  const { user, profile } = useAuth();
  
  const [isEditing, setIsEditing] = useState(false);
  const [editedTask, setEditedTask] = useState<Task | null>(null);
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [showAssigneeEditor, setShowAssigneeEditor] = useState(false);

  useEffect(() => {
    if (task?.assignees) {
      setSelectedAssignees(task.assignees.map(a => a.user_id));
    }
  }, [task]);

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

  const handleSaveAssignees = () => {
    if (onUpdateAssignees) {
      onUpdateAssignees(task.id, selectedAssignees);
    }
    setShowAssigneeEditor(false);
  };

  const toggleAssignee = (userId: string) => {
    setSelectedAssignees(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const getInitials = (name: string) => {
    const parts = name.split(" ");
    return `${parts[0]?.[0] || ""}${parts[1]?.[0] || ""}`.toUpperCase();
  };

  // Build list of assignable users
  const assignableUsers = [
    ...(user && profile ? [{
      id: user.id,
      name: `${profile.first_name} ${profile.last_name}`,
      initials: getInitials(`${profile.first_name} ${profile.last_name}`),
    }] : []),
    ...employees
      .filter(emp => emp.profile_id && emp.profile_id !== profile?.id)
      .map(emp => ({
        id: emp.profile_id!,
        name: `${emp.first_name} ${emp.last_name}`,
        initials: getInitials(`${emp.first_name} ${emp.last_name}`),
      }))
  ];

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
          {/* Assigned By Info */}
          {task.created_by_name && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-accent/50 p-2 rounded-md">
              <User className="h-4 w-4" />
              <span>Created by <strong className="text-foreground">{task.created_by_name}</strong></span>
            </div>
          )}

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

          {/* Assignees Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Assignees</Label>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-7 text-xs gap-1"
                onClick={() => setShowAssigneeEditor(!showAssigneeEditor)}
              >
                <UserPlus className="h-3 w-3" />
                Edit Assignees
              </Button>
            </div>
            
            {showAssigneeEditor ? (
              <div className="space-y-2">
                <ScrollArea className="h-[120px] border rounded-md p-2">
                  {assignableUsers.map((assignee) => (
                    <div
                      key={assignee.id}
                      className="flex items-center gap-3 p-2 rounded-md hover:bg-accent cursor-pointer"
                      onClick={() => toggleAssignee(assignee.id)}
                    >
                      <Checkbox
                        checked={selectedAssignees.includes(assignee.id)}
                        onCheckedChange={() => toggleAssignee(assignee.id)}
                      />
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">
                          {assignee.initials}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm">{assignee.name}</span>
                    </div>
                  ))}
                </ScrollArea>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => setShowAssigneeEditor(false)}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSaveAssignees}>
                    Save Assignees
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 p-2 bg-secondary/50 rounded-md min-h-[40px]">
                {task.assignees && task.assignees.length > 0 ? (
                  task.assignees.map((assignee, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 bg-background rounded-full px-2 py-1">
                      <Avatar className="h-5 w-5">
                        <AvatarFallback className="bg-primary/10 text-primary text-[10px]">
                          {getInitials(assignee.assignee_name || "?")}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs">{assignee.assignee_name}</span>
                      <span className="text-[10px] text-muted-foreground">
                        (by {assignee.assigner_name})
                      </span>
                    </div>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground">No assignees</span>
                )}
              </div>
            )}
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-4">
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
