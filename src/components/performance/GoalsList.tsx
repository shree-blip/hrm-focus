import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Target, Calendar, CheckCircle2, XCircle, Trash2 } from "lucide-react";
import type { PerformanceGoal } from "@/hooks/usePerformanceReviews";
import { useState } from "react";

interface Props {
  goals: PerformanceGoal[];
  onUpdateProgress: (id: string, progress: number) => void;
  onComplete: (id: string) => void;
  onCancel: (id: string) => void;
  onDelete: (id: string) => void;
  canManage: boolean;
}

const STATUS_CONFIG: Record<string, { label: string; variant: string; className: string }> = {
  active: { label: "Active", variant: "default", className: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" },
  completed: { label: "Completed", variant: "default", className: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" },
  cancelled: { label: "Cancelled", variant: "default", className: "bg-muted text-muted-foreground" },
  overdue: { label: "Overdue", variant: "default", className: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" },
};

export function GoalsList({ goals, onUpdateProgress, onComplete, onCancel, onDelete, canManage }: Props) {
  if (goals.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No goals set yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {goals.map(goal => (
        <GoalCard
          key={goal.id}
          goal={goal}
          onUpdateProgress={onUpdateProgress}
          onComplete={onComplete}
          onCancel={onCancel}
          onDelete={onDelete}
          canManage={canManage}
        />
      ))}
    </div>
  );
}

function GoalCard({
  goal, onUpdateProgress, onComplete, onCancel, onDelete, canManage,
}: {
  goal: PerformanceGoal;
  onUpdateProgress: (id: string, progress: number) => void;
  onComplete: (id: string) => void;
  onCancel: (id: string) => void;
  onDelete: (id: string) => void;
  canManage: boolean;
}) {
  const [editProgress, setEditProgress] = useState(false);
  const [progressValue, setProgressValue] = useState(goal.progress);
  const config = STATUS_CONFIG[goal.status] || STATUS_CONFIG.active;
  const isActive = goal.status === "active";

  return (
    <Card className="border hover:border-primary/20 transition-colors">
      <CardContent className="pt-4 pb-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h4 className="font-medium text-sm truncate">{goal.title}</h4>
              <Badge className={config.className}>{config.label}</Badge>
            </div>
            {goal.description && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{goal.description}</p>
            )}
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
              <span>{goal.employee_name}</span>
              {goal.target_date && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> {goal.target_date}
                </span>
              )}
            </div>
          </div>

          {canManage && isActive && (
            <div className="flex items-center gap-1 shrink-0">
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onComplete(goal.id)} title="Mark complete">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onCancel(goal.id)} title="Cancel">
                <XCircle className="h-4 w-4 text-muted-foreground" />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onDelete(goal.id)} title="Delete">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          )}
        </div>

        {/* Progress */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Progress</span>
            <span className="text-xs font-medium">{goal.progress}%</span>
          </div>
          <Progress value={goal.progress} className="h-2" />
        </div>

        {/* Update progress inline */}
        {isActive && (
          editProgress ? (
            <div className="flex items-center gap-2 pt-1">
              <Slider
                value={[progressValue]}
                onValueChange={([v]) => setProgressValue(v)}
                min={0}
                max={100}
                step={5}
                className="flex-1"
              />
              <span className="text-xs w-8 text-right">{progressValue}%</span>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => {
                  onUpdateProgress(goal.id, progressValue);
                  setEditProgress(false);
                }}
              >
                Save
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={() => { setProgressValue(goal.progress); setEditProgress(false); }}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs text-primary"
              onClick={() => setEditProgress(true)}
            >
              Update Progress
            </Button>
          )
        )}
      </CardContent>
    </Card>
  );
}
