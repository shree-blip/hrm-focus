import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Users,
  Loader2,
  MessageSquare,
  Bell,
  X as XIcon,
  Clock,
  Layers,
  FileText,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLeaveRequests } from "@/hooks/useLeaveRequests";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/hooks/useNotifications";
import { format, differenceInDays } from "date-fns";
import { Button } from "@/components/ui/button";
import { RequestLeaveDialog } from "@/components/leave/RequestLeaveDialog";
import { LeaveConflictDialog } from "@/components/leave/LeaveConflictDialog";
import { toast } from "@/hooks/use-toast";

// Special leave subtypes configuration
const SPECIAL_LEAVE_TYPES = {
  "Wedding Leave": { days: 15, color: "bg-pink-500" },
  "Bereavement Leave": { days: 15, color: "bg-slate-500" },
  "Maternity Leave": { days: 98, color: "bg-purple-500" },
  "Paternity Leave": { days: 22, color: "bg-indigo-500" },
} as const;

// Helper to check if a leave type is "Leave on Lieu"
const isLeaveOnLieuType = (leaveType: string) => {
  return leaveType.startsWith("Leave on Lieu");
};

// Helper to check if a leave type is "Other Leave"
const isOtherLeaveType = (leaveType: string) => {
  return leaveType.startsWith("Other Leave");
};

// Helper to check if a leave type is Sick Leave
const isSickLeaveType = (leaveType: string) => {
  return leaveType === "Other Leave - Sick Leave";
};

const Leave = () => {
  const { user, isManager } = useAuth();
  const {
    ownRequests,
    teamLeaves,
    allApprovedLeaves,
    balances,
    loading,
  } = useLeaveRequests();
  const { unreadCount } = useNotifications();
  const [showTeamLeaveBanner, setShowTeamLeaveBanner] = useState(true);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  // Get team members currently on leave (excluding current user)
  const getTeamMembersOnLeave = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return teamLeaves.filter((r) => {
      if (r.status !== "approved" || r.user_id === user?.id) return false;
      const startDate = new Date(r.start_date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(r.end_date);
      endDate.setHours(0, 0, 0, 0);
      return today >= startDate && today <= endDate;
    });
  };

  const teamMembersOnLeave = getTeamMembersOnLeave();
  const teamLeaveCount = teamMembersOnLeave.length;

  const calendarYear = calendarMonth.getFullYear();
  const calendarMonthIndex = calendarMonth.getMonth();
  const firstDayOffset = new Date(calendarYear, calendarMonthIndex, 1).getDay();
  const daysInMonth = new Date(calendarYear, calendarMonthIndex + 1, 0).getDate();

  // Read used_days DIRECTLY from leave_balances table (source of truth)
  const getAnnualLeaveUsedTotal = () => {
    const annualBalance = balances.find((b) => b.leave_type === "Annual Leave");
    return annualBalance ? annualBalance.used_days : 0;
  };

  const getAnnualLeaveTotalDays = () => {
    const annualBalance = balances.find((b) => b.leave_type === "Annual Leave");
    return annualBalance ? annualBalance.total_days : 12;
  };

  // Calculate special leave usage
  const getSpecialLeaveUsed = () => {
    const specialLeaveTypes = Object.keys(SPECIAL_LEAVE_TYPES);
    return ownRequests
      .filter((r) => r.status === "approved" && specialLeaveTypes.includes(r.leave_type) && r.user_id === user?.id)
      .reduce((sum, r) => sum + r.days, 0);
  };

  // Calculate Leave on Lieu usage
  const getLeaveOnLieuUsed = () => {
    return ownRequests
      .filter((r) => r.status === "approved" && isLeaveOnLieuType(r.leave_type) && r.user_id === user?.id)
      .reduce((sum, r) => sum + r.days, 0);
  };

  // Calculate Other Leave usage
  const getOtherLeaveUsed = () => {
    return ownRequests
      .filter((r) => r.status === "approved" && isOtherLeaveType(r.leave_type) && r.user_id === user?.id)
      .reduce((sum, r) => sum + r.days, 0);
  };

  // Get leave type display for history
  const getLeaveTypeDisplay = (leaveType: string) => {
    if (isLeaveOnLieuType(leaveType)) {
      const dateMatch = leaveType.match(/Leave on Lieu - (\d{4}-\d{2}-\d{2})/);
      if (dateMatch) {
        return `Lieu (worked: ${format(new Date(dateMatch[1] + "T12:00:00"), "MMM d")})`;
      }
      return leaveType.replace("Leave on Lieu - ", "Lieu: ");
    }
    if (isSickLeaveType(leaveType)) return "Sick Leave";
    if (isOtherLeaveType(leaveType)) return leaveType.replace("Other Leave - ", "");
    return leaveType;
  };

  const getLeaveTypeBadgeClass = (leaveType: string) => {
    if (leaveType === "Annual Leave") return "bg-primary/10 text-primary";
    if (isSickLeaveType(leaveType)) return "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30";
    if (Object.keys(SPECIAL_LEAVE_TYPES).includes(leaveType)) return "bg-warning/10 text-warning";
    if (isLeaveOnLieuType(leaveType)) return "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30";
    if (isOtherLeaveType(leaveType)) return "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/30";
    return "bg-muted text-muted-foreground";
  };

  // Own leave history (all statuses)
  const myLeaveHistory = ownRequests
    .filter((r) => r.user_id === user?.id)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-6 animate-fade-in">
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="heading-page font-display font-bold text-foreground">My Leave</h1>
            {unreadCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="relative gap-2 shrink-0"
                onClick={() => (window.location.href = "/notifications")}
              >
                <Bell className="h-4 w-4" />
                <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center bg-destructive text-destructive-foreground">
                  {unreadCount}
                </Badge>
              </Button>
            )}
          </div>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">View your leave balances and history</p>
        </div>
      </div>

      {/* Team On Leave Banner */}
      {showTeamLeaveBanner && teamLeaveCount > 0 && (
        <div className="mb-6 animate-slide-down">
          <Card className="bg-gradient-to-r from-success/10 via-success/5 to-emerald-500/5 border-success/30 border-2 overflow-hidden relative">
            <div className="absolute top-0 right-0 w-24 h-24 bg-success/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            <CardContent className="pt-4 pb-3 relative">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="mt-1">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-success to-emerald-600 flex items-center justify-center shadow-md">
                      <Users className="h-5 w-5 text-white" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-foreground">Team Members On Leave Today</h3>
                      <Badge className="bg-success text-success-foreground shadow-sm">
                        {teamLeaveCount} {teamLeaveCount === 1 ? "person" : "people"}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {teamMembersOnLeave.map((leave) => {
                        const employeeName = leave.profile
                          ? `${leave.profile.first_name} ${leave.profile.last_name}`
                          : "Team Member";
                        const initials = leave.profile
                          ? `${leave.profile.first_name[0]}${leave.profile.last_name[0]}`
                          : "TM";
                        const daysRemaining = Math.max(0, differenceInDays(new Date(leave.end_date), new Date()) + 1);
                        const isLieu = isLeaveOnLieuType(leave.leave_type);
                        const isSick = isSickLeaveType(leave.leave_type);
                        const isOther = isOtherLeaveType(leave.leave_type);

                        return (
                          <div
                            key={leave.id}
                            className="flex items-center gap-2 bg-white/70 dark:bg-gray-800/70 rounded-xl px-3 py-2 border border-success/20 shadow-sm hover:shadow-md transition-shadow"
                          >
                            <Avatar className="h-8 w-8 ring-2 ring-success/20">
                              <AvatarImage src="" />
                              <AvatarFallback className="bg-gradient-to-br from-success/30 to-emerald-500/30 text-success text-xs font-semibold">
                                {initials}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col">
                              <span className="text-sm font-medium leading-tight">{employeeName}</span>
                              <div className="flex items-center gap-1.5">
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "text-[10px] px-1.5 py-0 h-4",
                                    isSick
                                      ? "bg-red-500/10 text-red-600 border-red-500/30"
                                      : isLieu
                                        ? "bg-orange-500/10 text-orange-600 border-orange-500/30"
                                        : isOther
                                          ? "bg-violet-500/10 text-violet-600 border-violet-500/30"
                                          : "bg-success/10 text-success border-success/30",
                                  )}
                                >
                                  {isSick
                                    ? "Sick"
                                    : isLieu
                                      ? "Lieu"
                                      : isOther
                                        ? "Other"
                                        : leave.leave_type.replace(" Leave", "")}
                                </Badge>
                                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                  <Clock className="h-2.5 w-2.5" />
                                  {daysRemaining}d left
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 h-8 w-8 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowTeamLeaveBanner(false)}
                >
                  <XIcon className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Quick Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Card className="bg-primary/5 border-primary/20 hover:shadow-md transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Annual Leave Balance</p>
                <p className="text-2xl font-bold mt-1">{getAnnualLeaveTotalDays() - getAnnualLeaveUsedTotal()} days</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Calendar className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-info/5 border-info/20 hover:shadow-md transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Approved Leave</p>
                <p className="text-2xl font-bold mt-1">
                  {ownRequests.filter((r) => r.status === "approved" && r.user_id === user?.id).length} requests
                </p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-info/10 flex items-center justify-center">
                <Check className="h-6 w-6 text-info" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-warning/5 border-warning/20 hover:shadow-md transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Pending Requests</p>
                <p className="text-2xl font-bold mt-1">
                  {ownRequests.filter((r) => r.status === "pending" && r.user_id === user?.id).length}
                </p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-warning/10 flex items-center justify-center">
                <Clock className="h-6 w-6 text-warning" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-success/5 border-success/20 hover:shadow-md transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">On Leave Today</p>
                <p className="text-2xl font-bold mt-1">
                  {teamLeaveCount} {teamLeaveCount === 1 ? "person" : "people"}
                </p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-success/10 flex items-center justify-center">
                <Users className="h-6 w-6 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {/* Annual Leave Card */}
        <Card className="animate-slide-up opacity-0 hover:shadow-md transition-shadow" style={{ animationDelay: "100ms", animationFillMode: "forwards" }}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-medium text-muted-foreground">Annual Leave</p>
              <Badge variant="secondary">{getAnnualLeaveTotalDays() - getAnnualLeaveUsedTotal()} days left</Badge>
            </div>
            <div className="space-y-2">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-display font-bold">{getAnnualLeaveTotalDays() - getAnnualLeaveUsedTotal()}</span>
                <span className="text-muted-foreground">/ {getAnnualLeaveTotalDays()} days</span>
              </div>
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500 bg-primary"
                  style={{ width: `${Math.min((getAnnualLeaveUsedTotal() / getAnnualLeaveTotalDays()) * 100, 100)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {getAnnualLeaveUsedTotal()} days used • {((getAnnualLeaveUsedTotal() / getAnnualLeaveTotalDays()) * 100).toFixed(0)}% utilized
              </p>
              {getOtherLeaveUsed() > 0 && (
                <div className="mt-2 pt-2 border-t border-border">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <FileText className="h-3 w-3 text-violet-500" />
                    Includes {getOtherLeaveUsed()} day{getOtherLeaveUsed() !== 1 ? "s" : ""} of Other Leave
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Special Leave Card */}
        <Card className="animate-slide-up opacity-0 hover:shadow-md transition-shadow" style={{ animationDelay: "150ms", animationFillMode: "forwards" }}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-medium text-muted-foreground">Special Leave</p>
              <Badge variant="secondary" className="bg-warning/10 text-warning">Category based</Badge>
            </div>
            <div className="space-y-2">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-display font-bold">{getSpecialLeaveUsed()}</span>
                <span className="text-muted-foreground">days used</span>
              </div>
              <div className="space-y-2 mt-3">
                <div className="flex flex-wrap gap-1">
                  {Object.entries(SPECIAL_LEAVE_TYPES).map(([leaveType, config]) => {
                    const isTaken = ownRequests.some(
                      (r) => r.leave_type === leaveType && r.user_id === user?.id && (r.status === "approved" || r.status === "pending"),
                    );
                    return (
                      <Badge
                        key={leaveType}
                        variant={isTaken ? "default" : "outline"}
                        className={cn("text-xs", isTaken && "bg-warning text-warning-foreground")}
                      >
                        {leaveType.replace(" Leave", "")} ({config.days}d)
                        {isTaken && " ✓"}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Leave on Lieu Card */}
        <Card className="animate-slide-up opacity-0 hover:shadow-md transition-shadow border-orange-500/20" style={{ animationDelay: "200ms", animationFillMode: "forwards" }}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <Layers className="h-4 w-4 text-orange-500" />
                Leave on Lieu
              </p>
              <Badge variant="secondary" className="bg-orange-500/10 text-orange-600 dark:text-orange-400">Date based</Badge>
            </div>
            <div className="space-y-2">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-display font-bold text-orange-600 dark:text-orange-400">{getLeaveOnLieuUsed()}</span>
                <span className="text-muted-foreground">days used</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">For taking a day off when you worked on a holiday or leave day</p>
              <div className="flex items-center gap-2 mt-2 p-2 rounded-md bg-orange-500/5 border border-orange-500/10">
                <Calendar className="h-3.5 w-3.5 text-orange-500" />
                <span className="text-xs text-orange-600 dark:text-orange-400">Select date worked → Choose day off</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* My Leave History */}
        <Card className="lg:col-span-2 animate-slide-up opacity-0" style={{ animationDelay: "300ms", animationFillMode: "forwards" }}>
          <CardHeader className="pb-4">
            <CardTitle className="font-display text-lg flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              My Leave History
              <Badge variant="secondary" className="ml-2">{myLeaveHistory.length} total</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {myLeaveHistory.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-lg font-medium">No leave history</p>
                <p className="text-sm mt-1">Your leave requests will appear here.</p>
              </div>
            ) : (
              myLeaveHistory.map((request) => (
                <div
                  key={request.id}
                  className={cn(
                    "flex flex-col sm:flex-row sm:items-center gap-3 p-3 sm:p-4 rounded-xl border transition-all",
                    request.status === "pending" && "bg-warning/5 border-warning/20",
                    request.status === "approved" && "bg-success/5 border-success/20",
                    request.status === "rejected" && "bg-destructive/5 border-destructive/20",
                    request.status === "cancelled" && "bg-secondary/50 border-border",
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className={cn("text-xs", getLeaveTypeBadgeClass(request.leave_type))}>
                        {getLeaveTypeDisplay(request.leave_type)}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {format(new Date(request.start_date), "MMM d, yyyy")} - {format(new Date(request.end_date), "MMM d, yyyy")}
                      </span>
                    </div>
                    {request.reason && <p className="text-sm text-muted-foreground mt-1">"{request.reason}"</p>}
                    {request.status === "rejected" && request.rejection_reason && (
                      <div className="flex items-start gap-2 mt-2 p-2 rounded-lg bg-destructive/10 border border-destructive/20">
                        <MessageSquare className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                        <p className="text-sm text-destructive">
                          <span className="font-medium">Rejection reason:</span> {request.rejection_reason}
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 sm:flex-col sm:items-end">
                    <Badge
                      variant="outline"
                      className={cn(
                        "capitalize",
                        request.status === "pending" && "border-warning text-warning bg-warning/10",
                        request.status === "approved" && "border-success text-success bg-success/10",
                        request.status === "rejected" && "border-destructive text-destructive bg-destructive/10",
                        request.status === "cancelled" && "border-gray-400 text-gray-400 bg-gray-400/10",
                      )}
                    >
                      {request.status}
                    </Badge>
                    <span className="text-sm font-medium">{request.days} day{request.days !== 1 ? "s" : ""}</span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Team Calendar & Upcoming */}
        <div className="space-y-6">
          <Card className="animate-slide-up opacity-0" style={{ animationDelay: "400ms", animationFillMode: "forwards" }}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="font-display text-lg flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Team Calendar
                </CardTitle>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm font-medium px-2">{format(calendarMonth, "MMM yyyy")}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-1 text-center mb-4">
                {["S", "M", "T", "W", "T", "F", "S"].map((day, i) => (
                  <div key={i} className="text-xs font-medium text-muted-foreground py-2">{day}</div>
                ))}
                {Array.from({ length: firstDayOffset }, (_, i) => (
                  <div key={`empty-${i}`} className="py-2" />
                ))}
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                  const now = new Date();
                  const currentDate = new Date(calendarYear, calendarMonthIndex, day);
                  currentDate.setHours(0, 0, 0, 0);
                  const isToday = day === now.getDate() && calendarMonthIndex === now.getMonth() && calendarYear === now.getFullYear();
                  const todayNorm = new Date();
                  todayNorm.setHours(0, 0, 0, 0);

                  const isUserOnLeave = ownRequests.some((r) => {
                    if (r.status !== "approved" || r.user_id !== user?.id) return false;
                    const startDate = new Date(r.start_date);
                    startDate.setHours(0, 0, 0, 0);
                    const endDate = new Date(r.end_date);
                    endDate.setHours(0, 0, 0, 0);
                    return currentDate >= startDate && currentDate <= endDate && endDate >= todayNorm;
                  });

                  const othersOnLeave = allApprovedLeaves.some((r) => {
                    if (r.user_id === user?.id) return false;
                    const startDate = new Date(r.start_date);
                    startDate.setHours(0, 0, 0, 0);
                    const endDate = new Date(r.end_date);
                    endDate.setHours(0, 0, 0, 0);
                    return currentDate >= startDate && currentDate <= endDate && endDate >= todayNorm;
                  });

                  return (
                    <div
                      key={day}
                      className={cn(
                        "text-sm py-2 rounded-md cursor-pointer transition-colors relative",
                        isToday && "bg-primary text-primary-foreground font-medium",
                        isUserOnLeave && !isToday && "bg-success/30 text-success-foreground border border-success/50",
                        othersOnLeave && !isUserOnLeave && !isToday && "bg-warning/20 text-warning-foreground",
                      )}
                      title={isUserOnLeave ? "You are on leave" : othersOnLeave ? "Team member(s) on leave" : ""}
                    >
                      {day}
                      {(isUserOnLeave || othersOnLeave) && !isToday && (
                        <div className={cn("absolute bottom-0.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full", isUserOnLeave ? "bg-success" : "bg-warning")} />
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4 pb-2 border-b">
                <div className="flex items-center gap-1">
                  <div className="h-3 w-3 rounded bg-success/30 border border-success/50" />
                  <span>Your leave</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="h-3 w-3 rounded bg-warning/20" />
                  <span>Others on leave</span>
                </div>
              </div>

              <div className="space-y-2 pb-4 border-b border-border">
                <p className="text-sm font-medium mb-2">Currently On Leave</p>
                <div className="space-y-2">
                  {(() => {
                    const currentlyOnLeave = allApprovedLeaves.filter((r) => {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const startDate = new Date(r.start_date);
                      startDate.setHours(0, 0, 0, 0);
                      const endDate = new Date(r.end_date);
                      endDate.setHours(0, 0, 0, 0);
                      return today >= startDate && today <= endDate;
                    });

                    if (currentlyOnLeave.length === 0) {
                      return <p className="text-sm text-muted-foreground">No one is currently on leave</p>;
                    }

                    return currentlyOnLeave.map((r) => {
                      const employeeName = r.user_id === user?.id ? "You" : r.profile ? `${r.profile.first_name} ${r.profile.last_name}` : "Employee";
                      const isCurrentUser = r.user_id === user?.id;
                      return (
                        <div key={r.id} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <div className={cn("h-2 w-2 rounded-full", isCurrentUser ? "bg-success" : "bg-warning")} />
                            <span className={cn("font-medium", isCurrentUser && "text-success")}>{employeeName}</span>
                            <Badge variant="outline" className="text-xs">{r.leave_type.replace(" Leave", "")}</Badge>
                          </div>
                          <span className="text-muted-foreground text-xs">{format(new Date(r.end_date), "MMM d")}</span>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

              <div className="space-y-2 pt-4">
                <p className="text-sm font-medium mb-2">Upcoming Time Off</p>
                <div className="space-y-2">
                  {(() => {
                    const upcoming = allApprovedLeaves
                      .filter((r) => new Date(r.start_date) > new Date())
                      .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())
                      .slice(0, 5);

                    if (upcoming.length === 0) {
                      return <p className="text-sm text-muted-foreground">No upcoming time off scheduled</p>;
                    }

                    return upcoming.map((r) => {
                      const employeeName = r.user_id === user?.id ? "You" : r.profile ? `${r.profile.first_name} ${r.profile.last_name}` : "Employee";
                      const isCurrentUser = r.user_id === user?.id;
                      return (
                        <div key={r.id} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <div className={cn("h-2 w-2 rounded-full", isCurrentUser ? "bg-success" : "bg-warning")} />
                            <span className={cn("font-medium", isCurrentUser && "text-success")}>{employeeName}</span>
                          </div>
                          <span className="text-muted-foreground text-xs">
                            {format(new Date(r.start_date), "MMM d")} - {format(new Date(r.end_date), "MMM d")}
                          </span>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Leave;
