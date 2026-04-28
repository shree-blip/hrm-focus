import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLeaveRequests } from "@/hooks/useLeaveRequests";
import { usePromotions } from "@/hooks/usePromotions";
import { useAuth } from "@/contexts/AuthContext";
import { RejectReasonDialog } from "@/components/leave/RejectReasonDialog";
import { RequestLeaveDialog } from "@/components/leave/RequestLeaveDialog";
import { AdminLeaveDialog } from "@/components/leave/AdminLeaveDialog";
import { LeaveConflictDialog } from "@/components/leave/LeaveConflictDialog";
import { PromotionApprovalQueue } from "@/components/employees/PromotionApprovalQueue";
import { LeaveReportsTab } from "@/components/approvals/LeaveReportsTab";
import { format, startOfMonth, endOfMonth, parseISO } from "date-fns";
import {
  Check,
  X,
  Clock,
  Calendar,
  Loader2,
  MessageSquare,
  CheckCircle2,
  XCircle,
  RotateCcw,
  TrendingUp,
  Search,
  FilterX,
  Download,
  FileText,
  Plus,
  Shield,
} from "lucide-react";
import { usePersistentState } from "@/hooks/usePersistentState";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";

const MONTH_OPTIONS = [
  { value: "all", label: "All Months" },
  { value: "0", label: "January" },
  { value: "1", label: "February" },
  { value: "2", label: "March" },
  { value: "3", label: "April" },
  { value: "4", label: "May" },
  { value: "5", label: "June" },
  { value: "6", label: "July" },
  { value: "7", label: "August" },
  { value: "8", label: "September" },
  { value: "9", label: "October" },
  { value: "10", label: "November" },
  { value: "11", label: "December" },
];

const getLeaveTypeBadge = (type: string) => {
  if (type.includes("Annual"))
    return { bg: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400", label: "Annual Leave" };
  if (type.includes("Sick"))
    return { bg: "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400", label: "Sick Leave" };
  if (type.includes("Lieu"))
    return { bg: "bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-400", label: "Leave on Lieu" };
  if (type.includes("Other") && type.includes("Medical"))
    return { bg: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400", label: "Other Leave - Medical Emergency" };
  if (type.includes("Other"))
    return { bg: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300", label: type };
  if (type.includes("Wedding") || type.includes("Maternity") || type.includes("Paternity"))
    return { bg: "bg-pink-100 text-pink-700 dark:bg-pink-950/40 dark:text-pink-400", label: type };
  if (type.includes("Personal"))
    return { bg: "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400", label: "Personal Leave" };
  return { bg: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300", label: type };
};

const Approvals = () => {
  const { user, role, isVP, isAdmin, isLineManager, isSupervisor } = useAuth();
  const { requests, ownRequests, loading, approveRequest, rejectRequest, cancelRequest, createRequest, adminCreateLeave, refetch } = useLeaveRequests();
  const { pendingApprovals: pendingPromotions } = usePromotions();
  const [section, setSection] = usePersistentState<"leave" | "promotions" | "leave-reports">(
    "approvals:section",
    "leave",
  );
  const [activeTab, setActiveTab] = usePersistentState("approvals:activeTab", "pending");
  const [rejectDialogOpen, setRejectDialogOpen] = usePersistentState("approvals:rejectDialogOpen", false);
  const [selectedRequest, setSelectedRequest] = usePersistentState<{ id: string; name: string } | null>(
    "approvals:selectedRequest",
    null,
  );
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [filterMonth, setFilterMonth] = useState<string>(String(new Date().getMonth()));
  const [filterEmployee, setFilterEmployee] = useState<string>("all");
  const [filterLeaveType, setFilterLeaveType] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [adminDialogOpen, setAdminDialogOpen] = useState(false);
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false);
  const [conflictData, setConflictData] = useState<{
    requestId: string;
    employeeName: string;
    currentRequest: any;
    conflictingRequests: any[];
  } | null>(null);

  const currentYear = new Date().getFullYear();

  // Check if user is currently on leave
  const getCurrentUserLeave = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return ownRequests.find((r) => {
      if (r.status !== "approved" || r.user_id !== user?.id) return false;
      const startDate = new Date(r.start_date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(r.end_date);
      endDate.setHours(0, 0, 0, 0);
      return today >= startDate && today <= endDate;
    });
  };
  const currentUserLeave = getCurrentUserLeave();
  const isUserOnLeaveToday = !!currentUserLeave;

  // All requests by status (no month filter — raw counts for pending)
  const pendingRequests = useMemo(
    () => requests.filter((r) => r.user_id !== user?.id && r.status === "pending"),
    [requests, user?.id],
  );

  // Monthly filtering helper
  const filterByMonth = useMemo(() => {
    return (list: typeof requests) => {
      if (filterMonth === "all") return list;
      const month = parseInt(filterMonth);
      const monthStart = startOfMonth(new Date(currentYear, month));
      const monthEnd = endOfMonth(new Date(currentYear, month));
      return list.filter((r) => {
        const start = parseISO(r.start_date);
        return start >= monthStart && start <= monthEnd;
      });
    };
  }, [filterMonth, currentYear]);

  // Monthly stats
  const monthlyStats = useMemo(() => {
    const monthFiltered = filterByMonth(requests);
    return {
      // Pending count ignores month filter — all pending requests need attention regardless of start date
      pending: requests.filter((r) => r.user_id !== user?.id && r.status === "pending").length,
      approved: monthFiltered.filter((r) => r.status === "approved").length,
      rejected: monthFiltered.filter((r) => r.status === "rejected").length,
    };
  }, [requests, filterByMonth, user?.id]);

  const approvedRequests = useMemo(() => requests.filter((r) => r.status === "approved"), [requests]);
  const rejectedRequests = useMemo(() => requests.filter((r) => r.status === "rejected"), [requests]);

  const uniqueEmployees = useMemo(() => {
    const map = new Map<string, string>();
    requests.forEach((r) => {
      if (r.profile) map.set(r.user_id, `${r.profile.first_name} ${r.profile.last_name}`);
    });
    return Array.from(map.entries());
  }, [requests]);

  const uniqueLeaveTypes = useMemo(() => [...new Set(requests.map((r) => r.leave_type))], [requests]);

  const applyAllFilters = (list: typeof requests) => {
    let filtered = filterByMonth(list);
    if (filterEmployee !== "all") filtered = filtered.filter((r) => r.user_id === filterEmployee);
    if (filterLeaveType !== "all") filtered = filtered.filter((r) => r.leave_type === filterLeaveType);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((r) => {
        const name = r.profile ? `${r.profile.first_name} ${r.profile.last_name}`.toLowerCase() : "";
        return name.includes(q) || r.leave_type.toLowerCase().includes(q) || (r.reason || "").toLowerCase().includes(q);
      });
    }
    return filtered;
  };

  const filteredPending = useMemo(
    () => {
      // Pending list ignores month filter so future-dated pending requests are always visible
      let filtered = pendingRequests;
      if (filterEmployee !== "all") filtered = filtered.filter((r) => r.user_id === filterEmployee);
      if (filterLeaveType !== "all") filtered = filtered.filter((r) => r.leave_type === filterLeaveType);
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        filtered = filtered.filter((r) => {
          const name = r.profile ? `${r.profile.first_name} ${r.profile.last_name}`.toLowerCase() : "";
          return name.includes(q) || r.leave_type.toLowerCase().includes(q) || (r.reason || "").toLowerCase().includes(q);
        });
      }
      return filtered;
    },
    [pendingRequests, filterEmployee, filterLeaveType, searchQuery],
  );
  const filteredApproved = useMemo(
    () => applyAllFilters(approvedRequests),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [approvedRequests, filterMonth, filterEmployee, filterLeaveType, searchQuery],
  );
  const filteredRejected = useMemo(
    () => applyAllFilters(rejectedRequests),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rejectedRequests, filterMonth, filterEmployee, filterLeaveType, searchQuery],
  );

  const currentFiltered =
    activeTab === "pending" ? filteredPending : activeTab === "approved" ? filteredApproved : filteredRejected;

  const hasActiveFilters =
    filterMonth !== String(new Date().getMonth()) ||
    filterEmployee !== "all" ||
    filterLeaveType !== "all" ||
    searchQuery.trim() !== "";

  const clearFilters = () => {
    setFilterMonth(String(new Date().getMonth()));
    setFilterEmployee("all");
    setFilterLeaveType("all");
    setSearchQuery("");
  };

  // CSV export
  const exportCSV = (data: typeof requests, filename: string) => {
    if (data.length === 0) return;
    const header = ["Employee", "Email", "Leave Type", "Start Date", "End Date", "Days", "Status", "Reason", "Rejection Reason"];
    const rows = data.map((r) => [
      r.profile ? `${r.profile.first_name} ${r.profile.last_name}` : "Unknown",
      r.profile?.email || "",
      r.leave_type,
      r.start_date,
      r.end_date,
      r.days,
      r.status,
      r.reason || "",
      r.rejection_reason || "",
    ]);
    const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Check for overlapping dates
  const datesOverlap = (a: { start_date: string; end_date: string }, b: { start_date: string; end_date: string }) => {
    return a.start_date <= b.end_date && b.start_date <= a.end_date;
  };

  const handleApprove = async (requestId: string) => {
    const request = requests.find((r) => r.id === requestId);
    if (!request) return;

    if (request.user_id === user?.id) {
      toast({ title: "Cannot Approve", description: "You cannot approve your own leave request.", variant: "destructive" });
      return;
    }

    // Check for conflicting requests
    const conflicting = requests.filter(
      (r) => r.id !== requestId && r.user_id === request.user_id && r.status === "pending" && datesOverlap(request, r),
    );

    if (conflicting.length > 0) {
      const employeeName = request.profile ? `${request.profile.first_name} ${request.profile.last_name}` : "Employee";
      setConflictData({ requestId, employeeName, currentRequest: request, conflictingRequests: conflicting });
      setConflictDialogOpen(true);
      return;
    }

    setProcessingId(requestId);
    await approveRequest(requestId);
    setProcessingId(null);
    refetch();
  };

  const handleApproveWithConflictResolution = async (rejectOthers: boolean) => {
    if (!conflictData) return;
    setProcessingId(conflictData.requestId);
    await approveRequest(conflictData.requestId);
    if (rejectOthers) {
      for (const conflict of conflictData.conflictingRequests) {
        await rejectRequest(conflict.id, "Automatically rejected: conflicting leave request was approved for the same dates.");
      }
    }
    setProcessingId(null);
    setConflictDialogOpen(false);
    setConflictData(null);
    refetch();
  };

  const handleOpenRejectDialog = (id: string, name: string) => {
    setSelectedRequest({ id, name });
    setRejectDialogOpen(true);
  };

  const handleReject = async (reason: string) => {
    if (selectedRequest) {
      setProcessingId(selectedRequest.id);
      await rejectRequest(selectedRequest.id, reason || "Request denied");
      setSelectedRequest(null);
      setProcessingId(null);
      refetch();
    }
  };

  const handleRejectDialogOpenChange = (open: boolean) => {
    setRejectDialogOpen(open);
    if (!open) setSelectedRequest(null);
  };

  const handleSubmitRequest = async (request: {
    type: string;
    startDate: Date;
    endDate: Date;
    reason: string;
    is_half_day?: boolean;
    half_day_period?: string | null;
  }) => {
    return await createRequest({
      leave_type: request.type,
      start_date: request.startDate,
      end_date: request.endDate,
      reason: request.reason,
      is_half_day: request.is_half_day,
      half_day_period: request.half_day_period,
    });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { color: string; label: string }> = {
      pending: { color: "border-warning text-warning bg-warning/10", label: "Pending" },
      manager_approved: { color: "border-info text-info bg-info/10", label: "Manager Approved" },
      approved: { color: "border-success text-success bg-success/10", label: "Approved" },
      vp_approved: { color: "border-success text-success bg-success/10", label: "VP Approved" },
      rejected: { color: "border-destructive text-destructive bg-destructive/10", label: "Rejected" },
      manager_rejected: { color: "border-destructive text-destructive bg-destructive/10", label: "Manager Rejected" },
      vp_rejected: { color: "border-destructive text-destructive bg-destructive/10", label: "VP Rejected" },
      returned: { color: "border-warning text-warning bg-warning/10", label: "Returned" },
    };
    const config = statusConfig[status] || statusConfig.pending;
    return (
      <Badge variant="outline" className={config.color}>
        {config.label}
      </Badge>
    );
  };

  const renderRequestCard = (request: (typeof requests)[number], showActions: boolean = false) => {
    const employeeName = request.profile ? `${request.profile.first_name} ${request.profile.last_name}` : "Unknown";
    const initials = request.profile ? `${request.profile.first_name[0]}${request.profile.last_name[0]}` : "??";
    const isProcessing = processingId === request.id;
    const leaveTypeCfg = getLeaveTypeBadge(request.leave_type);

    return (
      <div
        key={request.id}
        className="flex items-start gap-4 p-4 rounded-xl bg-accent/30 border border-border hover:border-primary/20 transition-all"
      >
        <Avatar className="h-10 w-10">
          <AvatarImage src="" />
          <AvatarFallback className="bg-primary/10 text-primary font-medium">{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-medium">{employeeName}</p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge className={`text-[11px] px-2 py-0 font-medium border-0 rounded-md ${leaveTypeCfg.bg}`}>
                  {leaveTypeCfg.label}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {format(new Date(request.start_date), "MMM d")} – {format(new Date(request.end_date), "MMM d, yyyy")}
                </span>
              </div>
              {request.reason && <p className="text-sm text-muted-foreground mt-1 italic">"{request.reason}"</p>}
              {request.rejection_reason && (
                <div className="flex items-start gap-2 mt-2 p-2 rounded-lg bg-destructive/10 border border-destructive/20">
                  <MessageSquare className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                  <p className="text-sm text-destructive">
                    <span className="font-medium">Reason:</span> {request.rejection_reason}
                  </p>
                </div>
              )}
            </div>
            <div className="flex flex-col items-end gap-2">
              {getStatusBadge(request.status)}
              <span className="text-sm font-medium">
                {request.days} {request.days === 1 ? "day" : "days"}
              </span>
            </div>
          </div>

          {showActions && (
            <div className="flex gap-2 mt-3">
              <Button size="sm" className="gap-1" onClick={() => handleApprove(request.id)} disabled={isProcessing}>
                {isProcessing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1 text-destructive hover:bg-destructive/10"
                onClick={() => handleOpenRejectDialog(request.id, employeeName)}
                disabled={isProcessing}
              >
                <X className="h-3 w-3" />
                Reject
              </Button>
              {isVP && (request.status as string) === "manager_approved" && (
                <Button size="sm" variant="ghost" className="gap-1" disabled={isProcessing}>
                  <RotateCcw className="h-3 w-3" />
                  Return
                </Button>
              )}
            </div>
          )}

          {/* Cancel approved leave — Admin/VP/LM/Supervisor */}
          {request.status === "approved" && (isAdmin || isVP || isSupervisor || isLineManager) && (
            <div className="flex gap-2 mt-3">
              <Button
                size="sm"
                variant="outline"
                className="gap-1 text-destructive hover:bg-destructive/10"
                onClick={() => cancelRequest(request.id, "Cancelled by management")}
                disabled={isProcessing}
              >
                <X className="h-3 w-3" />
                Cancel Leave
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  const selectedMonthLabel =
    filterMonth === "all" ? "All Months" : MONTH_OPTIONS.find((m) => m.value === filterMonth)?.label || "";

  return (
    <DashboardLayout>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-6 sm:mb-8 animate-fade-in">
        <div>
          <h1 className="heading-page font-display font-bold text-foreground">Approvals</h1>
          <p className="text-muted-foreground mt-1">
            {isVP ? "Review and finalize approval requests" : "Review pending approval requests"}
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-warning/10 border border-warning/20">
            <Clock className="h-4 w-4 text-warning" />
            <span className="text-sm font-medium text-warning">
              {pendingRequests.length + pendingPromotions.length} Pending
            </span>
          </div>
          {(isAdmin || isVP) && (
            <Button variant="outline" className="gap-2 text-sm" onClick={() => setAdminDialogOpen(true)}>
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">Assign Leave</span>
              <span className="sm:hidden">Assign</span>
            </Button>
          )}
          <Button className="gap-2 shadow-md text-sm" onClick={() => setRequestDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Request Leave</span>
            <span className="sm:hidden">Request</span>
          </Button>
        </div>
      </div>

      {/* Top-level section tabs */}
      <Tabs
        value={section}
        onValueChange={(v) => setSection(v as "leave" | "promotions" | "leave-reports")}
        className="mb-6"
      >
        <TabsList>
          <TabsTrigger value="leave" className="gap-2">
            <Calendar className="h-4 w-4" />
            Leave ({pendingRequests.length})
          </TabsTrigger>
          <TabsTrigger value="promotions" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            Promotions ({pendingPromotions.length})
          </TabsTrigger>
          <TabsTrigger value="leave-reports" className="gap-2">
            <FileText className="h-4 w-4" />
            Leave Reports
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {section === "leave" && (
        <>
          {/* Stats — monthly */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8">
            <Card className="animate-slide-up">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Pending ({selectedMonthLabel})</p>
                    <p className="text-3xl font-display font-bold text-warning">{monthlyStats.pending}</p>
                  </div>
                  <div className="p-3 rounded-full bg-warning/10">
                    <Clock className="h-6 w-6 text-warning" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="animate-slide-up" style={{ animationDelay: "100ms" }}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Approved ({selectedMonthLabel})</p>
                    <p className="text-3xl font-display font-bold text-success">{monthlyStats.approved}</p>
                  </div>
                  <div className="p-3 rounded-full bg-success/10">
                    <CheckCircle2 className="h-6 w-6 text-success" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="animate-slide-up" style={{ animationDelay: "200ms" }}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Rejected ({selectedMonthLabel})</p>
                    <p className="text-3xl font-display font-bold text-destructive">{monthlyStats.rejected}</p>
                  </div>
                  <div className="p-3 rounded-full bg-destructive/10">
                    <XCircle className="h-6 w-6 text-destructive" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="animate-slide-up" style={{ animationDelay: "300ms" }}>
            <CardHeader>
              <div className="flex flex-col gap-4">
                <CardTitle className="font-display text-lg flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  Leave Requests
                </CardTitle>
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="flex-wrap h-auto gap-1">
                    <TabsTrigger value="pending" className="gap-2">
                      <Clock className="h-4 w-4" />
                      Pending ({filteredPending.length})
                    </TabsTrigger>
                    <TabsTrigger value="approved" className="gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      Approved ({filteredApproved.length})
                    </TabsTrigger>
                    <TabsTrigger value="rejected" className="gap-2">
                      <XCircle className="h-4 w-4" />
                      Rejected ({filteredRejected.length})
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Filter bar */}
              <div className="flex flex-wrap items-center gap-3 pb-4 border-b border-border mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search employee or reason..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 w-[220px] h-9"
                  />
                </div>

                <Select value={filterMonth} onValueChange={setFilterMonth}>
                  <SelectTrigger className="w-[150px] h-9">
                    <SelectValue placeholder="Month" />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTH_OPTIONS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={filterEmployee} onValueChange={setFilterEmployee}>
                  <SelectTrigger className="w-[180px] h-9">
                    <SelectValue placeholder="All Employees" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Employees</SelectItem>
                    {uniqueEmployees.map(([id, name]) => (
                      <SelectItem key={id} value={id}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={filterLeaveType} onValueChange={setFilterLeaveType}>
                  <SelectTrigger className="w-[180px] h-9">
                    <SelectValue placeholder="All Leave Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Leave Types</SelectItem>
                    {uniqueLeaveTypes.map((type) => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {hasActiveFilters && (
                  <Button size="sm" variant="ghost" className="gap-1.5 text-muted-foreground h-9" onClick={clearFilters}>
                    <FilterX className="h-4 w-4" />
                    Clear Filters
                  </Button>
                )}

                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2 ml-auto h-9"
                  onClick={() => exportCSV(currentFiltered, `${activeTab}-leaves`)}
                  disabled={currentFiltered.length === 0}
                >
                  <Download className="h-4 w-4" />
                  Export CSV
                </Button>
              </div>

              {/* Cards */}
              {activeTab === "pending" &&
                (filteredPending.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="font-medium">All caught up!</p>
                    <p className="text-sm">No pending approvals{filterMonth !== "all" ? ` for ${selectedMonthLabel}` : ""}</p>
                  </div>
                ) : (
                  filteredPending.map((request) => renderRequestCard(request, true))
                ))}

              {activeTab === "approved" &&
                (filteredApproved.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="font-medium">No approved requests</p>
                    <p className="text-sm">{hasActiveFilters ? "Try adjusting your filters" : ""}</p>
                  </div>
                ) : (
                  filteredApproved.map((request) => renderRequestCard(request, false))
                ))}

              {activeTab === "rejected" &&
                (filteredRejected.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="font-medium">No rejected requests</p>
                    <p className="text-sm">{hasActiveFilters ? "Try adjusting your filters" : ""}</p>
                  </div>
                ) : (
                  filteredRejected.map((request) => renderRequestCard(request, false))
                ))}
            </CardContent>
          </Card>

          <RejectReasonDialog
            open={rejectDialogOpen}
            onOpenChange={handleRejectDialogOpenChange}
            onConfirm={handleReject}
            employeeName={selectedRequest?.name || ""}
          />
          <LeaveConflictDialog
            open={conflictDialogOpen}
            onOpenChange={(open) => {
              setConflictDialogOpen(open);
              if (!open) setConflictData(null);
            }}
            employeeName={conflictData?.employeeName || ""}
            currentRequest={conflictData?.currentRequest || null}
            conflictingRequests={conflictData?.conflictingRequests || []}
            onApproveAnyway={() => handleApproveWithConflictResolution(false)}
            onRejectOthers={() => handleApproveWithConflictResolution(true)}
          />
        </>
      )}

      {section === "promotions" && <PromotionApprovalQueue />}

      {section === "leave-reports" && <LeaveReportsTab requests={requests} />}

      {/* Request Leave Dialog — available to all users */}
      <RequestLeaveDialog
        open={requestDialogOpen}
        onOpenChange={setRequestDialogOpen}
        onSubmit={handleSubmitRequest}
        isOnLeave={isUserOnLeaveToday}
        currentLeave={currentUserLeave}
      />

      {/* Admin Assign Leave Dialog */}
      {(isAdmin || isVP) && (
        <AdminLeaveDialog
          open={adminDialogOpen}
          onOpenChange={setAdminDialogOpen}
          onSubmit={async (params) => {
            await adminCreateLeave(params);
          }}
        />
      )}
    </DashboardLayout>
  );
};

export default Approvals;
