import { useAuth } from "@/contexts/AuthContext";
import { useEmployees } from "@/hooks/useEmployees";
import { useTasks } from "@/hooks/useTasks";
import { useLeaveRequests } from "@/hooks/useLeaveRequests";
import { useTeamAttendance } from "@/hooks/useTeamAttendance";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { startOfDay, endOfDay } from "date-fns";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Users,
  CheckCircle2,
  Clock,
  Calendar,
  TrendingUp,
  AlertCircle,
  UserCheck,
  Network,
  Mail,
  Crown,
} from "lucide-react";

interface Manager {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  job_title: string | null;
  department: string | null;
}

interface TeamMember {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  job_title: string | null;
  department: string | null;
  hasSubTeam?: boolean;
}

const getInitials = (firstName?: string | null, lastName?: string | null) =>
  `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase();

export function TeamReportsWidget() {
  const { user } = useAuth();
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

  // Team hierarchy — who I report to + my teammates
  const [managers, setManagers] = useState<Manager[]>([]);
  const [teammates, setTeammates] = useState<TeamMember[]>([]);
  const [hierarchyLoading, setHierarchyLoading] = useState(true);

  const fetchTeamHierarchy = useCallback(async () => {
    if (!user) return;
    setHierarchyLoading(true);

    const { data: employeeId } = await supabase.rpc("get_employee_id_for_user", {
      _user_id: user.id,
    });

    if (!employeeId) {
      setHierarchyLoading(false);
      return;
    }

    // Find who I report to
    const { data: managerRows } = await supabase
      .from("team_members")
      .select("manager_employee_id")
      .eq("member_employee_id", employeeId);

    const managerIds = (managerRows || []).map((r: { manager_employee_id: string }) => r.manager_employee_id);

    if (managerIds.length > 0) {
      const { data: managerData } = await supabase
        .from("employees")
        .select("id, first_name, last_name, email, job_title, department")
        .in("id", managerIds)
        .order("first_name", { ascending: true });

      setManagers(managerData || []);

      // Find teammates — other members under the same managers
      const allMemberIds = new Set<string>();

      for (const mgrId of managerIds) {
        const { data: teamRows } = await supabase
          .from("team_members")
          .select("member_employee_id")
          .eq("manager_employee_id", mgrId);

        (teamRows || []).forEach((r: { member_employee_id: string }) => {
          if (r.member_employee_id !== employeeId) {
            allMemberIds.add(r.member_employee_id);
          }
        });
      }

      const uniqueMemberIds = Array.from(allMemberIds);

      if (uniqueMemberIds.length > 0) {
        const { data: members } = await supabase
          .from("employees")
          .select("id, first_name, last_name, email, job_title, department")
          .in("id", uniqueMemberIds)
          .order("first_name", { ascending: true });

        const { data: subManagerRows } = await supabase
          .from("team_members")
          .select("manager_employee_id")
          .in("manager_employee_id", uniqueMemberIds);

        const subManagerSet = new Set(
          (subManagerRows || []).map((r: { manager_employee_id: string }) => r.manager_employee_id),
        );

        setTeammates(
          (members || []).map((m: Manager) => ({
            ...m,
            hasSubTeam: subManagerSet.has(m.id),
          })),
        );
      } else {
        setTeammates([]);
      }
    } else {
      setManagers([]);
      setTeammates([]);
    }

    setHierarchyLoading(false);
  }, [user]);

  useEffect(() => {
    fetchTeamHierarchy();
  }, [fetchTeamHierarchy]);

  // Today's clocked in count (from aggregated team attendance data)
  const [clockedInToday, setClockedInToday] = useState(0);

  useEffect(() => {
    const fetchClockedIn = async () => {
      const today = new Date();
      const dayStart = startOfDay(today).toISOString();
      const dayEnd = endOfDay(today).toISOString();

      const { data: logs } = await supabase
        .from("attendance_logs")
        .select("id, employee_id, user_id, clock_in, clock_out")
        .gte("clock_in", dayStart)
        .lte("clock_in", dayEnd)
        .is("clock_out", null);

      setClockedInToday(logs?.length || 0);
    };

    fetchClockedIn();

    // Real-time subscription for live updates
    const channel = supabase
      .channel("team-reports-attendance")
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance_logs" }, () => fetchClockedIn())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

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
        {/* Team Hierarchy */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <Network className="h-4 w-4 text-primary" />
            <span className="font-medium">My Teams & Hierarchy</span>
          </div>

          {hierarchyLoading ? (
            <div className="flex items-center justify-center py-6">
              <div className="h-5 w-5 border-2 border-muted-foreground/30 border-t-primary rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-3">
              {/* ─── I REPORT TO ─── */}
              <div className="rounded-xl border bg-card p-3 space-y-2.5">
                <div className="flex items-center gap-1.5">
                  <UserCheck className="h-3.5 w-3.5 text-primary" />
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">I Report To</p>
                </div>

                {managers.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">Not assigned to any manager yet.</p>
                ) : (
                  <div className="space-y-2">
                    {managers.map((mgr) => (
                      <div key={mgr.id} className="flex items-center gap-3 rounded-lg border bg-muted/30 p-2.5">
                        <Avatar className="h-9 w-9 shrink-0 ring-2 ring-primary/15">
                          <AvatarFallback className="bg-primary/10 text-primary font-semibold text-xs">
                            {getInitials(mgr.first_name, mgr.last_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-sm font-semibold truncate">
                              {mgr.first_name} {mgr.last_name}
                            </p>
                            <Badge className="h-4 px-1.5 text-[9px] bg-primary/10 text-primary border border-primary/20 hover:bg-primary/10">
                              <Crown className="mr-0.5 h-2.5 w-2.5" />
                              Manager
                            </Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                            {mgr.job_title || "Manager"}
                            {mgr.department ? ` · ${mgr.department}` : ""}
                          </p>
                        </div>
                        <a
                          href={`mailto:${mgr.email}`}
                          className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                          title={mgr.email}
                        >
                          <Mail className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    ))}
                  </div>
                )}

                {managers.length > 0 && (
                  <p className="text-[11px] text-muted-foreground/70 pt-1 border-t border-border/50">
                    Your Attendance, logsheet, leave & Support go to{" "}
                    <span className="font-medium text-foreground/70">
                      {managers.map((m) => m.first_name).join(" & ")}
                    </span>
                  </p>
                )}
              </div>

              {/* ─── TEAMMATES ─── */}
              <div className="rounded-xl border bg-card p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-primary" />
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Teammates</p>
                  </div>
                  <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                    {teammates.length}
                  </Badge>
                </div>

                {teammates.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No teammates found.</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {teammates.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center gap-2 rounded-lg border bg-muted/20 p-2 transition-colors hover:bg-muted/40"
                      >
                        <Avatar className="h-7 w-7 shrink-0">
                          <AvatarFallback className="bg-primary/10 text-primary font-medium text-[10px]">
                            {getInitials(member.first_name, member.last_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium truncate leading-tight">
                            {member.first_name} {member.last_name}
                          </p>
                          <p className="text-[10px] text-muted-foreground truncate leading-tight">
                            {member.job_title || "Team Member"}
                          </p>
                        </div>
                        {member.hasSubTeam && (
                          <span className="shrink-0 h-1.5 w-1.5 rounded-full bg-primary" title="Team Lead" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

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
