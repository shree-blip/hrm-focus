import { CheckCircle2, Circle, Clock, ArrowRight, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

const tasks = [
  {
    id: 1,
    title: "Monthly Bank Reconciliation - Client A",
    status: "in-progress",
    priority: "high",
    due: "Today",
    client: "Tech Solutions Inc",
  },
  {
    id: 2,
    title: "Q4 Tax Return Review",
    status: "pending",
    priority: "high",
    due: "Tomorrow",
    client: "Retail Corp",
  },
  {
    id: 3,
    title: "Payroll Processing - December",
    status: "pending",
    priority: "medium",
    due: "Dec 28",
    client: "Internal",
  },
  {
    id: 4,
    title: "Expense Report Audit",
    status: "completed",
    priority: "low",
    due: "Completed",
    client: "StartUp Ltd",
  },
];

export function TasksWidget() {
  return (
    <Card className="animate-slide-up opacity-0" style={{ animationDelay: "300ms", animationFillMode: "forwards" }}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            My Tasks
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
        {tasks.map((task, index) => (
          <div
            key={task.id}
            className={cn(
              "group flex items-start gap-3 p-3 rounded-lg transition-all duration-200 cursor-pointer",
              "hover:bg-accent/50 border border-transparent hover:border-border",
              task.status === "completed" && "opacity-60"
            )}
            style={{ animationDelay: `${400 + index * 100}ms` }}
          >
            <div className="mt-0.5">
              {task.status === "completed" ? (
                <CheckCircle2 className="h-5 w-5 text-success" />
              ) : task.status === "in-progress" ? (
                <Clock className="h-5 w-5 text-info animate-pulse" />
              ) : (
                <Circle className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p
                className={cn(
                  "font-medium text-sm truncate",
                  task.status === "completed" && "line-through text-muted-foreground"
                )}
              >
                {task.title}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{task.client}</p>
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
                task.due === "Today" && "text-destructive font-medium",
                task.due === "Tomorrow" && "text-warning",
                task.due === "Completed" && "text-success"
              )}>
                {task.due === "Today" && <AlertCircle className="h-3 w-3 inline mr-1" />}
                {task.due}
              </span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
