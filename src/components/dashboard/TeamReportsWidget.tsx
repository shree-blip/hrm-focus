import { useAuth } from "@/contexts/AuthContext";
import { useEmployees } from "@/hooks/useEmployees";
import { useTasks } from "@/hooks/useTasks";
import { useLeaveRequests } from "@/hooks/useLeaveRequests";
import { useTeamAttendance } from "@/hooks/useTeamAttendance";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { startOfDay, endOfDay } from "date-fns";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Users, CheckCircle2, Clock, Calendar, TrendingUp, AlertCircle, UserCheck } from "lucide-react";

export function TeamReportsWidget() {
  const { employees } = useEmployees();
  const { tasks } = useTasks();
  const { requests } = useLeaveRequests();
  const { teamAttendance } = useTeamAttendance();

  // Team stats
  const activeEmployees = employees.filter((e) => e.status === "active");
  const totalTeamMembers = activeEmployees.length;

  // Task distribution
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === "done").length;
  const inProgressTasks = tasks.filter((t) => t.status === "in-progress").length;
  const overdueTasks = tasks.filter((t) => {
    if (!t.due_date || t.status === "done") return false;
    return new Date(t.due_date) < new Date();
  }).length;
  const teamCompletionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Leave stats
  const pendingLeaveRequests = requests.filter((r) => r.status === "pending");

  // Today's clocked in count (from aggregated team attendance data)
  const clockedInToday = teamAttendance.filter((a) => a.days_worked > 0).length;

  // Top performers (most tasks completed)
  const tasksByAssignee = tasks.reduce(
    (acc, task) => {
      if (task.status === "done" && task.assignee_id) {
        acc[task.assignee_id] = (acc[task.assignee_id] || 0) + 1;
      }
      return acc;
    },
    {} as Record<string, number>,
  );

  const topPerformers = Object.entries(tasksByAssignee)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([userId, count]) => {
      const employee = employees.find((e) => e.profile_id === userId || e.id === userId);
      return { employee, count };
    })
    .filter((p) => p.employee);

  return (
    <Card className="animate-slide-up" style={{ animationDelay: "350ms" }}>
      <CardHeader className="pb-3">
        <CardTitle className="font-display text-lg flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          Team Reports
        </CardTitle>
        <CardDescription>Team performance overview</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Team Overview */}
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 rounded-lg bg-primary/5 border border-primary/20">
            <UserCheck className="h-5 w-5 mx-auto mb-1 text-primary" />
            <p className="text-2xl font-bold">{totalTeamMembers}</p>
            <p className="text-xs text-muted-foreground">Team Size</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-success/5 border border-success/20">
            <Clock className="h-5 w-5 mx-auto mb-1 text-success" />
            <p className="text-2xl font-bold">{clockedInToday}</p>
            <p className="text-xs text-muted-foreground">Clocked In</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-warning/5 border border-warning/20">
            <Calendar className="h-5 w-5 mx-auto mb-1 text-warning" />
            <p className="text-2xl font-bold">{pendingLeaveRequests.length}</p>
            <p className="text-xs text-muted-foreground">Leave Pending</p>
          </div>
        </div>

        {/* Team Task Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-success" />
              <span className="font-medium">Team Task Completion</span>
            </div>
            <span className="font-semibold">{teamCompletionRate}%</span>
          </div>
          <Progress value={teamCompletionRate} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{completedTasks} completed</span>
            <span>{inProgressTasks} in progress</span>
            {overdueTasks > 0 && (
              <span className="text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {overdueTasks} overdue
              </span>
            )}
          </div>
        </div>

        {/* Top Performers */}
        {topPerformers.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <TrendingUp className="h-4 w-4 text-success" />
              <span className="font-medium">Top Performers</span>
            </div>
            <div className="space-y-2">
              {topPerformers.map(({ employee, count }, idx) => (
                <div key={employee?.id || idx} className="flex items-center gap-3 p-2 rounded-lg bg-accent/30">
                  <div className="flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-bold">
                    {idx + 1}
                  </div>
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs bg-primary/10">
                      {employee?.first_name?.[0]}
                      {employee?.last_name?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {employee?.first_name} {employee?.last_name}
                    </p>
                    <p className="text-xs text-muted-foreground">{employee?.job_title}</p>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {count} tasks
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        {pendingLeaveRequests.length > 0 && (
          <div className="p-3 rounded-lg bg-warning/5 border border-warning/20">
            <div className="flex items-center gap-2 text-sm">
              <AlertCircle className="h-4 w-4 text-warning" />
              <span className="font-medium text-warning">Action Required</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {pendingLeaveRequests.length} leave request{pendingLeaveRequests.length > 1 ? "s" : ""} awaiting your
              approval
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
