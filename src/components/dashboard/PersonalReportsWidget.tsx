import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLeaveRequests } from "@/hooks/useLeaveRequests";
import { useAttendance } from "@/hooks/useAttendance";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { BarChart3, Clock, Calendar, Target, Users, Network, UserCheck, Mail, Crown } from "lucide-react";
import { format, startOfMonth, eachDayOfInterval, isWeekend } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

// ═══════════════════════════════════════════════════════════════════════════════
// COMPANY HOLIDAYS
// ═══════════════════════════════════════════════════════════════════════════════

const companyHolidays: Date[] = [
  new Date(2025, 0, 1),
  new Date(2025, 0, 15),
  new Date(2025, 2, 8),
  new Date(2025, 2, 14),
  new Date(2025, 3, 14),
  new Date(2025, 4, 1),
  new Date(2025, 4, 29),
  new Date(2025, 6, 4),
  new Date(2025, 9, 23),
  new Date(2025, 10, 1),
  new Date(2025, 10, 27),
  new Date(2025, 11, 25),
  new Date(2026, 0, 1),
  new Date(2026, 0, 11),
  new Date(2026, 0, 14),
  new Date(2026, 0, 30),
  new Date(2026, 1, 15),
  new Date(2026, 2, 2),
  new Date(2026, 2, 28),
  new Date(2026, 3, 14),
  new Date(2026, 4, 1),
];

const TOTAL_ANNUAL_LEAVE_DAYS = 12;
const HOURS_PER_DAY = 8;

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

const isCompanyHoliday = (date: Date): boolean => companyHolidays.some((h) => h.toDateString() === date.toDateString());

const isWorkingDay = (date: Date): boolean => !isWeekend(date) && !isCompanyHoliday(date);

const getWorkingDaysUpTo = (upToDate: Date): number => {
  const days = eachDayOfInterval({ start: startOfMonth(upToDate), end: upToDate });
  return days.filter(isWorkingDay).length;
};

const getTotalWorkingDaysInMonth = (date: Date): number => {
  const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  const days = eachDayOfInterval({ start: startOfMonth(date), end: monthEnd });
  return days.filter(isWorkingDay).length;
};

const getInitials = (firstName?: string | null, lastName?: string | null) =>
  `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase();

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface Manager {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  job_title: string | null;
  department: string | null;
}

interface TeamHierarchyMember {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  job_title: string | null;
  department: string | null;
  hasSubTeam?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function PersonalReportsWidget() {
  const { user } = useAuth();
  const { ownRequests, balances } = useLeaveRequests();
  const { monthlyHours } = useAttendance();

  const [managers, setManagers] = useState<Manager[]>([]);
  const [teammates, setTeammates] = useState<TeamHierarchyMember[]>([]);
  const [hierarchyLoading, setHierarchyLoading] = useState(true);

  const fetchTeamData = useCallback(async () => {
    if (!user) return;

    setHierarchyLoading(true);

    const { data: employeeId } = await supabase.rpc("get_employee_id_for_user", {
      _user_id: user.id,
    });

    if (!employeeId) {
      setHierarchyLoading(false);
      return;
    }

    const { data: managerRows } = await supabase
      .from("team_members")
      .select("manager_employee_id")
      .eq("member_employee_id", employeeId);

    const managerIds = (managerRows || []).map((r: any) => r.manager_employee_id);

    if (managerIds.length > 0) {
      const { data: managerData } = await supabase
        .from("employees")
        .select("id, first_name, last_name, email, job_title, department")
        .in("id", managerIds)
        .order("first_name", { ascending: true });

      setManagers(managerData || []);

      const allMemberIds = new Set<string>();

      for (const mgrId of managerIds) {
        const { data: teamRows } = await supabase
          .from("team_members")
          .select("member_employee_id")
          .eq("manager_employee_id", mgrId);

        (teamRows || []).forEach((r: any) => {
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

        const subManagerSet = new Set((subManagerRows || []).map((r: any) => r.manager_employee_id));

        setTeammates(
          (members || []).map((m: any) => ({
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
    fetchTeamData();
  }, [fetchTeamData]);

  // ═══════════════════════════════════════════════════════════════════════════
  // ATTENDANCE
  // ═══════════════════════════════════════════════════════════════════════════

  const now = new Date();
  const totalWorkingDays = getTotalWorkingDaysInMonth(now);
  const totalMonthlyHours = totalWorkingDays * HOURS_PER_DAY;
  const workingDaysPassed = getWorkingDaysUpTo(now);
  const expectedHoursSoFar = workingDaysPassed * HOURS_PER_DAY;
  const workingDaysRemaining = totalWorkingDays - workingDaysPassed;
  const remainingHoursNeeded = Math.max(0, totalMonthlyHours - monthlyHours);
  const progressPercent =
    totalMonthlyHours > 0 ? Math.min(100, Math.round((monthlyHours / totalMonthlyHours) * 100)) : 0;
  const hoursDifference = monthlyHours - expectedHoursSoFar;
  const isAhead = hoursDifference > 0;
  const avgHoursNeededPerDay =
    workingDaysRemaining > 0 ? (remainingHoursNeeded / workingDaysRemaining).toFixed(1) : "0";

  const getTrackingStatus = () => {
    if (isAhead)
      return {
        message: `${Math.abs(hoursDifference).toFixed(1)}h ahead of schedule`,
        color: "text-success",
        badgeClass: "bg-success/10 text-success border-success/30",
      };
    if (hoursDifference < 0)
      return {
        message: `${Math.abs(hoursDifference).toFixed(1)}h behind schedule`,
        color: "text-warning",
        badgeClass: "bg-warning/10 text-warning border-warning/30",
      };
    return {
      message: "Perfectly on track",
      color: "text-success",
      badgeClass: "bg-success/10 text-success border-success/30",
    };
  };

  const trackingStatus = getTrackingStatus();

  // ═══════════════════════════════════════════════════════════════════════════
  // LEAVE
  // ═══════════════════════════════════════════════════════════════════════════

  const annualLeaveBalance = balances.find((b: any) => b.leave_type === "Annual Leave");
  const annualLeaveUsed = annualLeaveBalance ? annualLeaveBalance.used_days : 0;
  const annualLeaveTotalDays = annualLeaveBalance ? annualLeaveBalance.total_days : TOTAL_ANNUAL_LEAVE_DAYS;
  const annualLeaveRemaining = annualLeaveTotalDays - annualLeaveUsed;
  const annualLeaveUsagePercent =
    annualLeaveTotalDays > 0 ? Math.round((annualLeaveUsed / annualLeaveTotalDays) * 100) : 0;
  const pendingLeaveCount = ownRequests.filter((r) => r.status === "pending" && r.user_id === user?.id).length;

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
        {/* ═══════════════════════════════════════════════════════════════════
            TEAM SECTION
            ═══════════════════════════════════════════════════════════════════ */}
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
              {/* ─── MANAGERS ─── */}
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

              {/* ─── TEAMMATES (compact grid) ─── */}
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

        {/* ═══════════════════════════════════════════════════════════════════
            ATTENDANCE
            ═══════════════════════════════════════════════════════════════════ */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-info" />
              <span className="font-medium">Attendance ({format(now, "MMMM")})</span>
            </div>
            <Badge variant="outline" className={trackingStatus.badgeClass}>
              {isAhead ? "+" : ""}
              {hoursDifference.toFixed(1)}h
            </Badge>
          </div>

          <div className="p-4 rounded-lg bg-info/5 border border-info/20">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-info" />
                <span className="text-sm font-medium">Performance Metrix</span>
              </div>
              <span className="text-2xl font-bold text-info">{progressPercent}%</span>
            </div>

            <Progress value={progressPercent} className="h-3 mb-3" />

            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-muted-foreground">Hours Logged</span>
              <span className="font-semibold">
                {monthlyHours}h <span className="text-muted-foreground font-normal">/ {totalMonthlyHours}h</span>
              </span>
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
              <span>
                {workingDaysPassed} of {totalWorkingDays} working days passed
              </span>
              <span>{workingDaysRemaining} days remaining</span>
            </div>

            <div className="pt-2 border-t border-info/20">
              <p className={`text-sm font-medium ${trackingStatus.color}`}>{trackingStatus.message}</p>
              {workingDaysRemaining > 0 && remainingHoursNeeded > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Need ~{avgHoursNeededPerDay}h/day for remaining {workingDaysRemaining} days to hit target
                </p>
              )}
              {remainingHoursNeeded <= 0 && <p className="text-xs text-success mt-1">🎉 Monthly target achieved!</p>}
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground/70 italic text-center">
            Mon-Fri, {HOURS_PER_DAY}h/day • Excludes weekends & public holidays
          </p>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            ANNUAL LEAVE
            ═══════════════════════════════════════════════════════════════════ */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-primary" />
            <span className="font-medium">Annual Leave Balance</span>
          </div>
          <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">Days Remaining</p>
              <Badge variant="secondary" className="bg-primary/10 text-primary">
                {annualLeaveUsagePercent}% used
              </Badge>
            </div>
            <div className="flex items-baseline gap-1 mb-3">
              <span className="text-3xl font-bold text-primary">{annualLeaveRemaining}</span>
              <span className="text-sm text-muted-foreground">/ {annualLeaveTotalDays} days</span>
            </div>
            <Progress value={annualLeaveUsagePercent} className="h-2 mb-2" />
            <p className="text-xs text-muted-foreground">{annualLeaveUsed} days used this year</p>
          </div>
          {pendingLeaveCount > 0 && (
            <Badge variant="outline" className="text-xs border-warning text-warning">
              {pendingLeaveCount} pending request{pendingLeaveCount > 1 ? "s" : ""}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
