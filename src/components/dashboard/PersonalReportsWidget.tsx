import { useAuth } from "@/contexts/AuthContext";
import { useTasks } from "@/hooks/useTasks";
import { useLeaveRequests } from "@/hooks/useLeaveRequests";
import { useAttendance } from "@/hooks/useAttendance";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  BarChart3, 
  CheckCircle2, 
  Clock, 
  Calendar,
  TrendingUp,
  TrendingDown,
  Minus
} from "lucide-react";
import { format, startOfMonth, differenceInBusinessDays } from "date-fns";

export function PersonalReportsWidget() {
  const { user } = useAuth();
  const { tasks } = useTasks();
  const { requests, balances } = useLeaveRequests();
  const { monthlyHours } = useAttendance();

  // Calculate personal task stats
  const myTasks = tasks.filter(t => t.assignee_id === user?.id || t.created_by === user?.id);
  const completedTasks = myTasks.filter(t => t.status === "done");
  const inProgressTasks = myTasks.filter(t => t.status === "in-progress");
  const todoTasks = myTasks.filter(t => t.status === "todo");
  const taskCompletionRate = myTasks.length > 0 
    ? Math.round((completedTasks.length / myTasks.length) * 100) 
    : 0;

  // Calculate attendance stats for this month
  const now = new Date();
  const monthStart = startOfMonth(now);
  const businessDays = differenceInBusinessDays(now, monthStart) + 1;
  const expectedHours = businessDays * 8;
  const attendanceRate = expectedHours > 0 
    ? Math.min(100, Math.round((monthlyHours / expectedHours) * 100))
    : 0;

  // Calculate leave stats
  const myLeaveRequests = requests.filter(r => r.user_id === user?.id);
  const pendingLeave = myLeaveRequests.filter(r => r.status === "pending");
  
  // Leave balance summary
  const annualLeaveBalance = balances.find(b => b.leave_type === "Annual")?.total_days || 0;
  const annualLeaveUsed = balances.find(b => b.leave_type === "Annual")?.used_days || 0;
  const sickLeaveBalance = balances.find(b => b.leave_type === "Sick")?.total_days || 0;
  const sickLeaveUsed = balances.find(b => b.leave_type === "Sick")?.used_days || 0;

  // Productivity trend (compare tasks completed this week vs last week)
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  
  const thisWeekCompleted = completedTasks.filter(t => 
    new Date(t.created_at) >= weekAgo
  ).length;
  const lastWeekCompleted = completedTasks.filter(t => 
    new Date(t.created_at) >= twoWeeksAgo && new Date(t.created_at) < weekAgo
  ).length;

  const getTrendIcon = () => {
    if (thisWeekCompleted > lastWeekCompleted) {
      return <TrendingUp className="h-4 w-4 text-success" />;
    } else if (thisWeekCompleted < lastWeekCompleted) {
      return <TrendingDown className="h-4 w-4 text-destructive" />;
    }
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <Card className="animate-slide-up" style={{ animationDelay: "300ms" }}>
      <CardHeader className="pb-3">
        <CardTitle className="font-display text-lg flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          My Reports
        </CardTitle>
        <CardDescription>Your personal performance summary</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Task Completion */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-success" />
              <span className="font-medium">Task Completion</span>
            </div>
            <div className="flex items-center gap-2">
              {getTrendIcon()}
              <span className="font-semibold">{taskCompletionRate}%</span>
            </div>
          </div>
          <Progress value={taskCompletionRate} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{completedTasks.length} completed</span>
            <span>{inProgressTasks.length} in progress</span>
            <span>{todoTasks.length} todo</span>
          </div>
        </div>

        {/* Attendance */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-info" />
              <span className="font-medium">Attendance ({format(now, "MMMM")})</span>
            </div>
            <span className="font-semibold">{monthlyHours}h / {expectedHours}h</span>
          </div>
          <Progress value={attendanceRate} className="h-2" />
          <p className="text-xs text-muted-foreground">
            {attendanceRate >= 90 ? "Great attendance!" : 
             attendanceRate >= 70 ? "On track" : "Needs improvement"}
          </p>
        </div>

        {/* Leave Balance */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-warning" />
            <span className="font-medium">Leave Balance</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-accent/50 border border-border">
              <p className="text-xs text-muted-foreground mb-1">Annual Leave</p>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-bold">{annualLeaveBalance - annualLeaveUsed}</span>
                <span className="text-xs text-muted-foreground">/ {annualLeaveBalance} days</span>
              </div>
            </div>
            <div className="p-3 rounded-lg bg-accent/50 border border-border">
              <p className="text-xs text-muted-foreground mb-1">Sick Leave</p>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-bold">{sickLeaveBalance - sickLeaveUsed}</span>
                <span className="text-xs text-muted-foreground">/ {sickLeaveBalance} days</span>
              </div>
            </div>
          </div>
          {pendingLeave.length > 0 && (
            <Badge variant="outline" className="text-xs">
              {pendingLeave.length} pending request{pendingLeave.length > 1 ? "s" : ""}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
