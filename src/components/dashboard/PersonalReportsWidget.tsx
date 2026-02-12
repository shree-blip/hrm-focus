import { useAuth } from "@/contexts/AuthContext";
import { useTasks } from "@/hooks/useTasks";
import { useLeaveRequests } from "@/hooks/useLeaveRequests";
import { useAttendance } from "@/hooks/useAttendance";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { BarChart3, CheckCircle2, Clock, Calendar, TrendingUp, TrendingDown, Minus, Target } from "lucide-react";
import { format, startOfMonth, eachDayOfInterval, isWeekend } from "date-fns";

// ═══════════════════════════════════════════════════════════════════════════════
// COMPANY HOLIDAYS (from CompanyCalendar)
// ═══════════════════════════════════════════════════════════════════════════════

const companyHolidays: Date[] = [
  // ── 2025 ──
  new Date(2025, 0, 1), // New Year's Day
  new Date(2025, 0, 15), // Maghe Sankranti
  new Date(2025, 2, 8), // Maha Shivaratri
  new Date(2025, 2, 14), // Holi
  new Date(2025, 3, 14), // Nepali New Year
  new Date(2025, 4, 1), // May Day
  new Date(2025, 4, 29), // Republic Day
  new Date(2025, 6, 4), // Independence Day (US)
  new Date(2025, 9, 23), // Dashain
  new Date(2025, 10, 1), // Tihar
  new Date(2025, 10, 27), // Thanksgiving (US)
  new Date(2025, 11, 25), // Christmas Day

  // ── 2026 ──
  new Date(2026, 0, 1), // New Year's Day
  new Date(2026, 0, 11), // Prithvi Jayanti
  new Date(2026, 0, 14), // Maghe Sankranti
  new Date(2026, 0, 30), // Martyrs' Day
  new Date(2026, 1, 15), // Maha Shivaratri
  new Date(2026, 2, 2), // Holi
  new Date(2026, 2, 28), // Company Holiday
  new Date(2026, 3, 14), // Nepali New Year
  new Date(2026, 4, 1), // Labor Day
];

// Constants
const TOTAL_ANNUAL_LEAVE_DAYS = 12;
const HOURS_PER_DAY = 8;

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check if a date is a company holiday
 */
const isCompanyHoliday = (date: Date): boolean => {
  return companyHolidays.some((holiday) => holiday.toDateString() === date.toDateString());
};

/**
 * Check if a date is a working day (Monday-Friday, not a holiday)
 */
const isWorkingDay = (date: Date): boolean => {
  if (isWeekend(date)) return false;
  if (isCompanyHoliday(date)) return false;
  return true;
};

/**
 * Calculate working days in current month up to a specific date
 */
const getWorkingDaysUpTo = (upToDate: Date): number => {
  const monthStart = startOfMonth(upToDate);
  const days = eachDayOfInterval({ start: monthStart, end: upToDate });
  return days.filter(isWorkingDay).length;
};

/**
 * Get total working days in the entire month
 */
const getTotalWorkingDaysInMonth = (date: Date): number => {
  const monthStart = startOfMonth(date);
  const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  return days.filter(isWorkingDay).length;
};

export function PersonalReportsWidget() {
  const { user } = useAuth();
  const { tasks } = useTasks();
  const { ownRequests } = useLeaveRequests();
  const { monthlyHours } = useAttendance();

  // Calculate personal task stats
  const myTasks = tasks.filter((t) => t.assignee_id === user?.id || t.created_by === user?.id);
  const completedTasks = myTasks.filter((t) => t.status === "done");
  const inProgressTasks = myTasks.filter((t) => t.status === "in-progress");
  const todoTasks = myTasks.filter((t) => t.status === "todo");
  const taskCompletionRate = myTasks.length > 0 ? Math.round((completedTasks.length / myTasks.length) * 100) : 0;

  // ═══════════════════════════════════════════════════════════════════════════
  // ATTENDANCE CALCULATIONS
  // ═══════════════════════════════════════════════════════════════════════════
  const now = new Date();

  // Total working days & hours for the FULL month
  const totalWorkingDays = getTotalWorkingDaysInMonth(now);
  const totalMonthlyHours = totalWorkingDays * HOURS_PER_DAY; // e.g., 20 days × 8h = 160h

  // Working days passed so far (including today)
  const workingDaysPassed = getWorkingDaysUpTo(now);
  const expectedHoursSoFar = workingDaysPassed * HOURS_PER_DAY; // Expected by today

  // Remaining working days & hours
  const workingDaysRemaining = totalWorkingDays - workingDaysPassed;
  const remainingHoursNeeded = Math.max(0, totalMonthlyHours - monthlyHours);

  // Progress percentage (toward full month target)
  const progressPercent =
    totalMonthlyHours > 0 ? Math.min(100, Math.round((monthlyHours / totalMonthlyHours) * 100)) : 0;

  // How much ahead or behind compared to where they should be TODAY
  const hoursDifference = monthlyHours - expectedHoursSoFar;
  const isAhead = hoursDifference > 0;
  const isBehind = hoursDifference < 0;
  const isOnTrack = hoursDifference === 0;

  // Average hours needed per remaining day to hit target
  const avgHoursNeededPerDay =
    workingDaysRemaining > 0 ? (remainingHoursNeeded / workingDaysRemaining).toFixed(1) : "0";

  // ═══════════════════════════════════════════════════════════════════════════
  // LEAVE CALCULATIONS
  // ═══════════════════════════════════════════════════════════════════════════
  const annualLeaveUsed = ownRequests
    .filter((r) => r.status === "approved" && r.leave_type === "Annual Leave" && r.user_id === user?.id)
    .reduce((sum, r) => sum + r.days, 0);

  const annualLeaveRemaining = TOTAL_ANNUAL_LEAVE_DAYS - annualLeaveUsed;
  const annualLeaveUsagePercent = Math.round((annualLeaveUsed / TOTAL_ANNUAL_LEAVE_DAYS) * 100);

  const pendingLeaveCount = ownRequests.filter((r) => r.status === "pending" && r.user_id === user?.id).length;

  // ═══════════════════════════════════════════════════════════════════════════
  // TASK TREND
  // ═══════════════════════════════════════════════════════════════════════════
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const thisWeekCompleted = completedTasks.filter((t) => new Date(t.created_at) >= weekAgo).length;
  const lastWeekCompleted = completedTasks.filter(
    (t) => new Date(t.created_at) >= twoWeeksAgo && new Date(t.created_at) < weekAgo,
  ).length;

  const getTrendIcon = () => {
    if (thisWeekCompleted > lastWeekCompleted) {
      return <TrendingUp className="h-4 w-4 text-success" />;
    } else if (thisWeekCompleted < lastWeekCompleted) {
      return <TrendingDown className="h-4 w-4 text-destructive" />;
    }
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  // Get status based on tracking
  const getTrackingStatus = () => {
    if (isAhead) {
      return {
        message: `${Math.abs(hoursDifference).toFixed(1)}h ahead of schedule`,
        color: "text-success",
        badgeClass: "bg-success/10 text-success border-success/30",
      };
    } else if (isBehind) {
      return {
        message: `${Math.abs(hoursDifference).toFixed(1)}h behind schedule`,
        color: "text-warning",
        badgeClass: "bg-warning/10 text-warning border-warning/30",
      };
    }
    return {
      message: "Perfectly on track!",
      color: "text-success",
      badgeClass: "bg-success/10 text-success border-success/30",
    };
  };

  const trackingStatus = getTrackingStatus();

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

        {/* Attendance - Full Month Tracking */}
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

          {/* Main progress toward monthly target */}
          <div className="p-4 rounded-lg bg-info/5 border border-info/20">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-info" />
                <span className="text-sm font-medium">Monthly Target</span>
              </div>
              <span className="text-2xl font-bold text-info">{progressPercent}%</span>
            </div>

            <Progress value={progressPercent} className="h-3 mb-3" />

            {/* Hours logged vs target */}
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-muted-foreground">Hours Logged</span>
              <span className="font-semibold">
                {monthlyHours}h <span className="text-muted-foreground font-normal">/ {totalMonthlyHours}h</span>
              </span>
            </div>

            {/* Working days info */}
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
              <span>
                {workingDaysPassed} of {totalWorkingDays} working days passed
              </span>
              <span>{workingDaysRemaining} days remaining</span>
            </div>

            {/* Tracking status */}
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

          {/* Schedule info */}
          <p className="text-[11px] text-muted-foreground/70 italic text-center">
            Mon-Fri, {HOURS_PER_DAY}h/day • Excludes weekends & public holidays
          </p>
        </div>

        {/* Annual Leave Balance */}
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
              <span className="text-sm text-muted-foreground">/ {TOTAL_ANNUAL_LEAVE_DAYS} days</span>
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
