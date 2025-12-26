import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

interface NewHire {
  id: number;
  name: string;
  initials: string;
  role: string;
  department: string;
  startDate: string;
  progress: number;
  status: string;
  tasks: { name: string; completed: boolean }[];
}

interface OnboardingChecklistDialogProps {
  hire: NewHire | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (hire: NewHire) => void;
}

export function OnboardingChecklistDialog({
  hire,
  open,
  onOpenChange,
  onUpdate,
}: OnboardingChecklistDialogProps) {
  if (!hire) return null;

  const handleTaskToggle = (taskIndex: number) => {
    const updatedTasks = [...hire.tasks];
    updatedTasks[taskIndex].completed = !updatedTasks[taskIndex].completed;

    const completedCount = updatedTasks.filter((t) => t.completed).length;
    const progress = Math.round((completedCount / updatedTasks.length) * 100);
    const status = progress === 100 ? "completed" : progress > 0 ? "in-progress" : "pending";

    const updatedHire = {
      ...hire,
      tasks: updatedTasks,
      progress,
      status,
    };

    onUpdate(updatedHire);

    if (progress === 100) {
      toast({
        title: "Onboarding Complete",
        description: `${hire.name}'s onboarding has been completed.`,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Onboarding Checklist</DialogTitle>
          <DialogDescription>
            Complete the onboarding tasks for the new hire.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Employee Info */}
          <div className="flex items-center gap-4 p-4 bg-secondary/50 rounded-lg">
            <Avatar className="h-12 w-12">
              <AvatarFallback className="bg-primary/10 text-primary font-medium">
                {hire.initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h3 className="font-semibold">{hire.name}</h3>
              <p className="text-sm text-muted-foreground">
                {hire.role} • {hire.department}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Start Date: {hire.startDate}
              </p>
            </div>
            <Badge
              variant="outline"
              className={cn(
                hire.status === "in-progress" && "border-info text-info bg-info/10",
                hire.status === "pending" && "border-warning text-warning bg-warning/10",
                hire.status === "completed" && "border-success text-success bg-success/10"
              )}
            >
              {hire.status === "in-progress" ? "In Progress" : hire.status}
            </Badge>
          </div>

          {/* Progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Overall Progress</span>
              <span className="font-medium">{hire.progress}%</span>
            </div>
            <Progress value={hire.progress} className="h-2" />
          </div>

          {/* Task List */}
          <div className="space-y-3">
            <h4 className="font-medium text-sm">Onboarding Tasks</h4>
            {hire.tasks.map((task, index) => (
              <div
                key={task.name}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border border-border transition-all cursor-pointer",
                  task.completed
                    ? "bg-success/5 border-success/30"
                    : "hover:bg-secondary/50"
                )}
                onClick={() => handleTaskToggle(index)}
              >
                <Checkbox
                  checked={task.completed}
                  onCheckedChange={() => handleTaskToggle(index)}
                />
                <span
                  className={cn(
                    "flex-1 text-sm",
                    task.completed && "line-through text-muted-foreground"
                  )}
                >
                  {task.name}
                </span>
                {task.completed ? (
                  <CheckCircle2 className="h-4 w-4 text-success" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            {hire.progress === 100 && (
              <Button
                onClick={() => {
                  onOpenChange(false);
                  toast({
                    title: "Onboarding Finalized",
                    description: `${hire.name} is now fully onboarded.`,
                  });
                }}
              >
                Complete Onboarding
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
