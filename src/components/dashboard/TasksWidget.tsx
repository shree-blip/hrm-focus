import { CheckCircle2, Circle, Clock, ArrowRight, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { useTasks } from "@/hooks/useTasks";
import { useAuth } from "@/contexts/AuthContext";
import { format, isToday, isTomorrow, parseISO } from "date-fns";

export function TasksWidget() {
  const { tasks, loading } = useTasks();
  const { isManager } = useAuth();

  // Get only the first 4 tasks for the widget
  const displayTasks = tasks.slice(0, 4);

  const formatDueDate = (dueDate: string | null) => {
    if (!dueDate) return "No due date";
    const date = parseISO(dueDate);
    if (isToday(date)) return "Today";
    if (isTomorrow(date)) return "Tomorrow";
    return format(date, "MMM d");
  };

  const isCompleted = (status: string) => status === "done";
  const isInProgress = (status: string) => status === "in-progress";

  return (
    <Card className="animate-slide-up opacity-0" style={{ animationDelay: "300ms", animationFillMode: "forwards" }}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            {isManager ? "Team Tasks" : "My Tasks"}
          </CardTitle>
          <Link to="/tasks">
            <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80 gap-1">
              View All
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="text-center py-4 text-muted-foreground text-sm">Loading tasks...</div>
        ) : displayTasks.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground text-sm">No tasks found</div>
        ) : (
          displayTasks.map((task, index) => {
            const dueLabel = formatDueDate(task.due_date);
            const isDueToday = dueLabel === "Today";
            const completed = isCompleted(task.status);

            return (
              <div
                key={task.id}
                className={cn(
                  "group flex items-start gap-3 p-3 rounded-lg transition-all duration-200 cursor-pointer",
                  "hover:bg-accent/50 border border-transparent hover:border-border",
                  completed && "opacity-60"
                )}
                style={{ animationDelay: `${400 + index * 100}ms` }}
              >
                <div className="mt-0.5">
                  {completed ? (
                    <CheckCircle2 className="h-5 w-5 text-success" />
                  ) : isInProgress(task.status) ? (
                    <Clock className="h-5 w-5 text-info animate-pulse" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className={cn(
                      "font-medium text-sm truncate",
                      completed && "line-through text-muted-foreground"
                    )}
                  >
                    {task.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {task.client_name || "No client"}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs",
                      task.priority === "high" && "border-destructive/50 text-destructive",
                      task.priority === "medium" && "border-warning/50 text-warning",
                      task.priority === "low" && "border-muted-foreground/50 text-muted-foreground"
                    )}
                  >
                    {task.priority}
                  </Badge>
                  <span className={cn(
                    "text-xs",
                    isDueToday && !completed && "text-destructive font-medium",
                    dueLabel === "Tomorrow" && !completed && "text-warning",
                    completed && "text-success"
                  )}>
                    {isDueToday && !completed && <AlertCircle className="h-3 w-3 inline mr-1" />}
                    {completed ? "Completed" : dueLabel}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}