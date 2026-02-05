import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Calendar,
  Plus,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  Users,
  Loader2,
  MessageSquare,
  Bell,
  X as XIcon,
  Clock,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { RequestLeaveDialog } from "@/components/leave/RequestLeaveDialog";
import { RejectReasonDialog } from "@/components/leave/RejectReasonDialog";
import { useLeaveRequests } from "@/hooks/useLeaveRequests";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/hooks/useNotifications";
import { format, differenceInDays } from "date-fns";
import { toast } from "@/hooks/use-toast";

// Special leave subtypes configuration
export const SPECIAL_LEAVE_TYPES = {
  "Wedding Leave": { days: 15, color: "bg-pink-500" },
  "Bereavement Leave": { days: 15, color: "bg-slate-500" },
  "Maternity Leave": { days: 98, color: "bg-purple-500" },
  "Paternity Leave": { days: 22, color: "bg-indigo-500" },
} as const;

export type SpecialLeaveType = keyof typeof SPECIAL_LEAVE_TYPES;

// Helper to check if a leave type is "Leave on Leave"
export const isLeaveOnLeaveType = (leaveType: string) => {
  return leaveType.startsWith("Leave on Leave");
};

const Leave = () => {
  const { user, isManager } = useAuth();
  const { requests, ownRequests, teamLeaves, balances, loading, createRequest, approveRequest, rejectRequest } =
    useLeaveRequests();
  const { unreadCount } = useNotifications();
  const [activeTab, setActiveTab] = useState("all");
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<{ id: string; name: string } | null>(null);
  const [showTeamLeaveBanner, setShowTeamLeaveBanner] = useState(true);

  // Function to get requests for display based on user role and active tab
  const getRequestsForDisplay = () => {
    if (isManager && activeTab === "pending") {
      return requests.filter((req) => req.status === "pending");
    }
    return ownRequests.filter((req) => {
      if (activeTab === "all") return true;
      return req.status === activeTab;
    });
  };

  const filteredRequests = getRequestsForDisplay();

  // Get team members currently on leave (excluding current user)
  const getTeamMembersOnLeave = () => {
    const today = new Date();
    return teamLeaves.filter((r) => {
      if (r.status !== "approved" || r.user_id === user?.id) return false;
      const startDate = new Date(r.start_date);
      const endDate = new Date(r.end_date);
      return today >= startDate && today <= endDate;
    });
  };

  const teamMembersOnLeave = getTeamMembersOnLeave();
  const teamLeaveCount = teamMembersOnLeave.length;

  // Get current user's active leave details
  const getCurrentUserLeave = () => {
    const today = new Date();
    return ownRequests.find((r) => {
      if (r.status !== "approved" || r.user_id !== user?.id) return false;
      const startDate = new Date(r.start_date);
      const endDate = new Date(r.end_date);
      return today >= startDate && today <= endDate;
    });
  };

  const currentUserLeave = getCurrentUserLeave();
  const isUserOnLeaveToday = !!currentUserLeave;

  const handleApprove = async (id: string) => {
    const request = requests.find((r) => r.id === id);
    if (request?.user_id === user?.id) {
      toast({
        title: "Cannot Approve",
        description: "You cannot approve your own leave request.",
        variant: "destructive",
      });
      return;
    }
    await approveRequest(id);
  };

  const handleOpenRejectDialog = (id: string, name: string) => {
    setSelectedRequest({ id, name });
    setRejectDialogOpen(true);
  };

  const handleReject = async (reason: string) => {
    if (selectedRequest) {
      await rejectRequest(selectedRequest.id, reason || "Request denied by manager");
      setSelectedRequest(null);
    }
  };

  const handleSubmitRequest = async (request: { type: string; startDate: Date; endDate: Date; reason: string }) => {
    await createRequest({
      leave_type: request.type,
      start_date: request.startDate,
      end_date: request.endDate,
      reason: request.reason,
    });
  };

  // Calculate used days for each leave type from approved requests (ONLY for current user)
  const getUsedDaysForType = (leaveType: string) => {
    return ownRequests
      .filter((r) => r.status === "approved" && r.leave_type === leaveType && r.user_id === user?.id)
      .reduce((sum, r) => sum + r.days, 0);
  };

  // Calculate special leave usage (sum of all special leave subtypes) (ONLY for current user)
  const getSpecialLeaveUsed = () => {
    const specialLeaveTypes = Object.keys(SPECIAL_LEAVE_TYPES);
    return ownRequests
      .filter((r) => r.status === "approved" && specialLeaveTypes.includes(r.leave_type) && r.user_id === user?.id)
      .reduce((sum, r) => sum + r.days, 0);
  };

  // Calculate Leave on Leave usage
  const getLeaveOnLeaveUsed = () => {
    return ownRequests
      .filter((r) => r.status === "approved" && isLeaveOnLeaveType(r.leave_type) && r.user_id === user?.id)
      .reduce((sum, r) => sum + r.days, 0);
  };

  // Get pending requests count (only user's own)
  const ownPendingRequests = ownRequests.filter((r) => r.status === "pending" && r.user_id === user?.id).length;

  // For managers, show total pending count in badge
  const pendingRequestsCount = isManager ? requests.filter((r) => r.status === "pending").length : ownPendingRequests;

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
      {/* Header with Notifications Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 animate-fade-in">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-display font-bold text-foreground">Leave Management</h1>
            {unreadCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="relative gap-2"
                onClick={() => (window.location.href = "/notifications")}
              >
                <Bell className="h-4 w-4" />
                <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center bg-destructive text-destructive-foreground">
                  {unreadCount}
                </Badge>
              </Button>
            )}
          </div>
          <p className="text-muted-foreground mt-1">Manage leave requests and track balances</p>
        </div>
        <div className="flex items-center gap-3">
          {ownPendingRequests > 0 && (
            <Badge variant="outline" className="text-warning border-warning">
              {ownPendingRequests} pending request{ownPendingRequests !== 1 ? "s" : ""}
            </Badge>
          )}
          <Button className="gap-2 shadow-md" onClick={() => setRequestDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            Request Leave
          </Button>
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
                      <h3 className="font-semibold text-success-foreground text-black">Team Members On Leave Today</h3>
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
                        const endDate = format(new Date(leave.end_date), "MMM d");
                        const daysRemaining = Math.max(0, differenceInDays(new Date(leave.end_date), new Date()) + 1);

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
                                  className="text-[10px] px-1.5 py-0 h-4 bg-success/10 text-success border-success/30"
                                >
                                  {leave.leave_type.replace(" Leave", "")}
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Card className="bg-primary/5 border-primary/20 hover:shadow-md transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Annual Leave Balance</p>
                <p className="text-2xl font-bold mt-1">{12 - getUsedDaysForType("Annual Leave")} days</p>
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
                  {ownRequests.filter((r) => r.status === "approved").length} requests
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
                <p className="text-2xl font-bold mt-1">{pendingRequestsCount}</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-warning/10 flex items-center justify-center">
                <Loader2 className="h-6 w-6 text-warning" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-success/5 border-success/20 hover:shadow-md transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Teams on Leave</p>
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {/* Annual Leave Card */}
        <Card
          className="animate-slide-up opacity-0 hover:shadow-md transition-shadow"
          style={{ animationDelay: "100ms", animationFillMode: "forwards" }}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-medium text-muted-foreground">Annual Leave</p>
              <Badge variant="secondary">{12 - getUsedDaysForType("Annual Leave")} days left</Badge>
            </div>
            <div className="space-y-2">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-display font-bold">{12 - getUsedDaysForType("Annual Leave")}</span>
                <span className="text-muted-foreground">/ 12 days</span>
              </div>
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500 bg-primary"
                  style={{ width: `${Math.min((getUsedDaysForType("Annual Leave") / 12) * 100, 100)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {getUsedDaysForType("Annual Leave")} days used •{" "}
                {((getUsedDaysForType("Annual Leave") / 12) * 100).toFixed(0)}% utilized
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Special Leave Card */}
        <Card
          className="animate-slide-up opacity-0 hover:shadow-md transition-shadow"
          style={{ animationDelay: "150ms", animationFillMode: "forwards" }}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-medium text-muted-foreground">Special Leave</p>
              <Badge variant="secondary" className="bg-warning/10 text-warning">
                Category based
              </Badge>
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
                      (r) =>
                        r.leave_type === leaveType &&
                        r.user_id === user?.id &&
                        (r.status === "approved" || r.status === "pending"),
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

        {/* Leave on Leave Card */}
        <Card
          className="animate-slide-up opacity-0 hover:shadow-md transition-shadow border-orange-500/20"
          style={{ animationDelay: "200ms", animationFillMode: "forwards" }}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <Layers className="h-4 w-4 text-orange-500" />
                Leave on Leave
              </p>
              <Badge variant="secondary" className="bg-orange-500/10 text-orange-600 dark:text-orange-400">
                Priority
              </Badge>
            </div>
            <div className="space-y-2">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-display font-bold text-orange-600 dark:text-orange-400">
                  {getLeaveOnLeaveUsed()}
                </span>
                <span className="text-muted-foreground">days used</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                For requesting additional leave while on existing approved leave
              </p>
              <div className="flex flex-wrap gap-1 mt-2">
                {["Extension", "Medical", "Family", "Travel", "Other"].map((type) => (
                  <Badge
                    key={type}
                    variant="outline"
                    className="text-xs border-orange-500/30 text-orange-600 dark:text-orange-400"
                  >
                    {type}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Leave Requests Panel */}
        <Card
          className="lg:col-span-2 animate-slide-up opacity-0"
          style={{ animationDelay: "300ms", animationFillMode: "forwards" }}
        >
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <CardTitle className="font-display text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Leave Requests
                {pendingRequestsCount > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {pendingRequestsCount} pending
                  </Badge>
                )}
              </CardTitle>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="w-full sm:w-auto grid grid-cols-3 sm:flex">
                  <TabsTrigger value="all" className="text-xs sm:text-sm">
                    All
                    <Badge variant="outline" className="ml-2 text-xs">
                      {isManager && activeTab === "all" ? requests.length : ownRequests.length}
                    </Badge>
                  </TabsTrigger>
                  <TabsTrigger value="pending" className="text-xs sm:text-sm">
                    Pending
                    <Badge variant="outline" className="ml-2 text-xs bg-warning/10 text-warning">
                      {pendingRequestsCount}
                    </Badge>
                  </TabsTrigger>
                  <TabsTrigger value="approved" className="text-xs sm:text-sm">
                    Approved
                    <Badge variant="outline" className="ml-2 text-xs bg-success/10 text-success">
                      {ownRequests.filter((r) => r.status === "approved").length}
                    </Badge>
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {filteredRequests.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-lg font-medium">No leave requests found</p>
                <p className="text-sm mt-1">
                  {activeTab === "all"
                    ? "Submit your first leave request to get started."
                    : `No ${activeTab} leave requests.`}
                </p>
                {activeTab === "all" && (
                  <Button className="mt-4" onClick={() => setRequestDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Request Leave
                  </Button>
                )}
              </div>
            ) : (
              filteredRequests.map((request, index) => {
                const isOwnRequest = request.user_id === user?.id;
                const employeeName = request.profile
                  ? `${request.profile.first_name} ${request.profile.last_name}`
                  : "Unknown Employee";
                const initials = request.profile
                  ? `${request.profile.first_name[0]}${request.profile.last_name[0]}`
                  : "??";
                const email = request.profile?.email || "";
                const isLeaveOnLeave = isLeaveOnLeaveType(request.leave_type);

                // Determine leave type badge color
                const getLeaveTypeBadgeClass = (leaveType: string) => {
                  if (leaveType === "Annual Leave") return "bg-primary/10 text-primary";
                  if (Object.keys(SPECIAL_LEAVE_TYPES).includes(leaveType)) return "bg-warning/10 text-warning";
                  if (isLeaveOnLeaveType(leaveType))
                    return "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30";
                  return "bg-muted text-muted-foreground";
                };

                // Get display name for leave type (clean up Leave on Leave prefix)
                const getLeaveTypeDisplay = (leaveType: string) => {
                  if (isLeaveOnLeaveType(leaveType)) {
                    return leaveType.replace("Leave on Leave - ", "");
                  }
                  return leaveType;
                };

                return (
                  <div
                    key={request.id}
                    className={cn(
                      "flex items-start gap-4 p-4 rounded-xl border transition-all animate-fade-in",
                      request.status === "pending" &&
                        !isLeaveOnLeave &&
                        "bg-warning/5 border-warning/20 hover:border-warning/40",
                      request.status === "pending" &&
                        isLeaveOnLeave &&
                        "bg-gradient-to-r from-orange-500/10 to-amber-500/5 border-orange-500/30 hover:border-orange-500/50",
                      request.status === "approved" && "bg-success/5 border-success/20 hover:border-success/40",
                      request.status === "rejected" &&
                        "bg-destructive/5 border-destructive/20 hover:border-destructive/40",
                      request.status === "cancelled" &&
                        "bg-secondary/50 border-border hover:border-muted-foreground/30",
                    )}
                    style={{ animationDelay: `${400 + index * 100}ms` }}
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarImage src="" />
                      <AvatarFallback
                        className={cn(
                          request.status === "pending" && !isLeaveOnLeave && "bg-warning/20 text-warning",
                          request.status === "pending" && isLeaveOnLeave && "bg-orange-500/20 text-orange-600",
                          request.status === "approved" && "bg-success/20 text-success",
                          request.status === "rejected" && "bg-destructive/20 text-destructive",
                          !["pending", "approved", "rejected"].includes(request.status) && "bg-primary/10 text-primary",
                        )}
                      >
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{isOwnRequest ? "You" : employeeName}</p>
                            {!isOwnRequest && isManager && (
                              <span className="text-xs text-muted-foreground">{email}</span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mt-0.5">
                            {isLeaveOnLeave && (
                              <Badge
                                variant="outline"
                                className="text-xs bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30 flex items-center gap-1"
                              >
                                <Layers className="h-3 w-3" />
                                Leave on Leave
                              </Badge>
                            )}
                            <Badge
                              variant="outline"
                              className={cn("text-xs", getLeaveTypeBadgeClass(request.leave_type))}
                            >
                              {getLeaveTypeDisplay(request.leave_type)}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {format(new Date(request.start_date), "MMM d, yyyy")} -{" "}
                              {format(new Date(request.end_date), "MMM d, yyyy")}
                            </span>
                          </div>
                          {request.reason && <p className="text-sm text-muted-foreground mt-2">"{request.reason}"</p>}
                          {request.status === "rejected" && request.rejection_reason && (
                            <div className="flex items-start gap-2 mt-2 p-2 rounded-lg bg-destructive/10 border border-destructive/20">
                              <MessageSquare className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                              <p className="text-sm text-destructive">
                                <span className="font-medium">Rejection reason:</span> {request.rejection_reason}
                              </p>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <div className="flex items-center gap-1">
                            {isLeaveOnLeave && request.status === "pending" && (
                              <Badge className="bg-orange-500 text-white text-[10px] px-1.5">Priority</Badge>
                            )}
                            <Badge
                              variant="outline"
                              className={cn(
                                "capitalize",
                                request.status === "pending" &&
                                  !isLeaveOnLeave &&
                                  "border-warning text-warning bg-warning/10",
                                request.status === "pending" &&
                                  isLeaveOnLeave &&
                                  "border-orange-500 text-orange-600 dark:text-orange-400 bg-orange-500/10",
                                request.status === "approved" && "border-success text-success bg-success/10",
                                request.status === "rejected" &&
                                  "border-destructive text-destructive bg-destructive/10",
                                request.status === "cancelled" && "border-gray-400 text-gray-400 bg-gray-400/10",
                              )}
                            >
                              {request.status}
                            </Badge>
                          </div>
                          <span className="text-sm font-medium">
                            {request.days} day{request.days !== 1 ? "s" : ""}
                          </span>
                        </div>
                      </div>
                      {request.status === "pending" && isManager && !isOwnRequest && (
                        <div className="flex gap-2 mt-3">
                          <Button size="sm" className="gap-1" onClick={() => handleApprove(request.id)}>
                            <Check className="h-3 w-3" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 text-destructive hover:bg-destructive/10"
                            onClick={() => handleOpenRejectDialog(request.id, employeeName)}
                          >
                            <X className="h-3 w-3" />
                            Reject
                          </Button>
                        </div>
                      )}
                      {request.status === "pending" && isOwnRequest && (
                        <p className="text-xs text-muted-foreground mt-2">Awaiting manager approval</p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Team Calendar & Notifications Panel */}
        <div className="space-y-6">
          <Card
            className="animate-slide-up opacity-0"
            style={{ animationDelay: "400ms", animationFillMode: "forwards" }}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="font-display text-lg flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Team Calendar
                </CardTitle>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm font-medium px-2">{format(new Date(), "MMM yyyy")}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-1 text-center mb-4">
                {["S", "M", "T", "W", "T", "F", "S"].map((day, i) => (
                  <div key={i} className="text-xs font-medium text-muted-foreground py-2">
                    {day}
                  </div>
                ))}
                {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => {
                  const today = new Date().getDate();
                  const currentMonth = new Date().getMonth();
                  const currentYear = new Date().getFullYear();
                  const currentDate = new Date(currentYear, currentMonth, day);

                  const isUserOnLeave = ownRequests.some((r) => {
                    if (r.status !== "approved" || r.user_id !== user?.id) return false;
                    const startDate = new Date(r.start_date);
                    const endDate = new Date(r.end_date);
                    return currentDate >= startDate && currentDate <= endDate;
                  });

                  const othersOnLeave = teamLeaves.some((r) => {
                    if (r.status !== "approved" || r.user_id === user?.id) return false;
                    const startDate = new Date(r.start_date);
                    const endDate = new Date(r.end_date);
                    return currentDate >= startDate && currentDate <= endDate;
                  });

                  return (
                    <div
                      key={day}
                      className={cn(
                        "text-sm py-2 rounded-md cursor-pointer transition-colors relative",
                        day === today && "bg-primary text-primary-foreground font-medium",
                        isUserOnLeave &&
                          day !== today &&
                          "bg-success/30 text-success-foreground border border-success/50",
                        othersOnLeave && !isUserOnLeave && day !== today && "bg-warning/20 text-warning-foreground",
                      )}
                      title={isUserOnLeave ? "You are on leave" : othersOnLeave ? "Team member(s) on leave" : ""}
                    >
                      {day}
                      {(isUserOnLeave || othersOnLeave) && day !== today && (
                        <div
                          className={cn(
                            "absolute bottom-0.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full",
                            isUserOnLeave ? "bg-success" : "bg-warning",
                          )}
                        />
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
                  <span>Team on leave</span>
                </div>
              </div>

              <div className="space-y-2 pb-4 border-b border-border">
                <p className="text-sm font-medium mb-2">Currently On Leave</p>
                <div className="space-y-2">
                  {(() => {
                    const currentlyOnLeave = teamLeaves.filter((r) => {
                      if (r.status !== "approved") return false;
                      const today = new Date();
                      const startDate = new Date(r.start_date);
                      const endDate = new Date(r.end_date);
                      return today >= startDate && today <= endDate;
                    });

                    if (currentlyOnLeave.length === 0) {
                      return <p className="text-sm text-muted-foreground">No one is currently on leave</p>;
                    }

                    return currentlyOnLeave.map((r) => {
                      const employeeName =
                        r.user_id === user?.id
                          ? "You"
                          : r.profile
                            ? `${r.profile.first_name} ${r.profile.last_name}`
                            : "Employee";
                      const isCurrentUser = r.user_id === user?.id;
                      return (
                        <div key={r.id} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <div className={cn("h-2 w-2 rounded-full", isCurrentUser ? "bg-success" : "bg-warning")} />
                            <span className={cn("font-medium", isCurrentUser && "text-success")}>{employeeName}</span>
                            <Badge variant="outline" className="text-xs">
                              {r.leave_type.replace(" Leave", "")}
                            </Badge>
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
                    const upcoming = teamLeaves
                      .filter((r) => r.status === "approved" && new Date(r.start_date) > new Date())
                      .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())
                      .slice(0, 5);

                    if (upcoming.length === 0) {
                      return <p className="text-sm text-muted-foreground">No upcoming time off scheduled</p>;
                    }

                    return upcoming.map((r) => {
                      const employeeName =
                        r.user_id === user?.id
                          ? "You"
                          : r.profile
                            ? `${r.profile.first_name} ${r.profile.last_name}`
                            : "Employee";
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

          <Card
            className="animate-slide-up opacity-0"
            style={{ animationDelay: "500ms", animationFillMode: "forwards" }}
          >
            <CardHeader>
              <CardTitle className="font-display text-lg flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                Recent Notifications
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {unreadCount > 0 ? (
                  <>
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Bell className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">
                          You have {unreadCount} new notification{unreadCount !== 1 ? "s" : ""}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">Check your notifications for updates</p>
                      </div>
                    </div>
                    <Button className="w-full gap-2" onClick={() => (window.location.href = "/notifications")}>
                      <Bell className="h-4 w-4" />
                      View All Notifications
                    </Button>
                  </>
                ) : (
                  <div className="text-center py-4 text-muted-foreground">
                    <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p>No new notifications</p>
                    <p className="text-xs mt-1">You're all caught up!</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dialogs */}
      <RequestLeaveDialog
        open={requestDialogOpen}
        onOpenChange={setRequestDialogOpen}
        onSubmit={handleSubmitRequest}
        isOnLeave={isUserOnLeaveToday}
        currentLeave={currentUserLeave}
      />
      <RejectReasonDialog
        open={rejectDialogOpen}
        onOpenChange={setRejectDialogOpen}
        onConfirm={handleReject}
        employeeName={selectedRequest?.name || ""}
      />
    </DashboardLayout>
  );
};

export default Leave;
