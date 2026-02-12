import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useLeaveRequests } from "@/hooks/useLeaveRequests";
import { useAuth } from "@/contexts/AuthContext";
import { RejectReasonDialog } from "@/components/leave/RejectReasonDialog";
import { format } from "date-fns";
import { 
  Check, 
  X, 
  Clock, 
  Calendar, 
  Loader2, 
  MessageSquare, 
  ArrowUpRight,
  CheckCircle2,
  XCircle,
  RotateCcw
} from "lucide-react";
import { cn } from "@/lib/utils";

const Approvals = () => {
  const { user, role, isVP } = useAuth();
  const { requests, loading, approveRequest, rejectRequest, refetch } = useLeaveRequests();
  const [activeTab, setActiveTab] = useState("pending");
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<{ id: string; name: string } | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Filter requests based on approval stage
  // Manager sees: pending requests from their team
  // VP sees: all pending requests for final approval
  const pendingRequests = requests.filter(r => {
    if (r.user_id === user?.id) return false; // Can't approve own requests
    return r.status === "pending";
  });

  const approvedRequests = requests.filter(r => r.status === "approved");

  const rejectedRequests = requests.filter(r => r.status === "rejected");

  const handleApprove = async (requestId: string) => {
    setProcessingId(requestId);
    await approveRequest(requestId);
    setProcessingId(null);
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
    return <Badge variant="outline" className={config.color}>{config.label}</Badge>;
  };

  const renderRequestCard = (request: any, showActions: boolean = false) => {
    const employeeName = request.profile 
      ? `${request.profile.first_name} ${request.profile.last_name}` 
      : "Unknown";
    const initials = request.profile 
      ? `${request.profile.first_name[0]}${request.profile.last_name[0]}` 
      : "??";
    const isProcessing = processingId === request.id;

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
              <p className="text-sm text-muted-foreground mt-0.5">
                {request.leave_type} • {format(new Date(request.start_date), "MMM d, yyyy")} - {format(new Date(request.end_date), "MMM d, yyyy")}
              </p>
              {request.reason && (
                <p className="text-sm text-muted-foreground mt-1 italic">"{request.reason}"</p>
              )}
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
              <span className="text-sm font-medium">{request.days} days</span>
            </div>
          </div>
          
          {showActions && (
            <div className="flex gap-2 mt-3">
              <Button 
                size="sm" 
                className="gap-1" 
                onClick={() => handleApprove(request.id)}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Check className="h-3 w-3" />
                )}
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
              {isVP && request.status === "manager_approved" && (
                <Button 
                  size="sm" 
                  variant="ghost"
                  className="gap-1"
                  disabled={isProcessing}
                >
                  <RotateCcw className="h-3 w-3" />
                  Return
                </Button>
              )}
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

  return (
    <DashboardLayout>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 animate-fade-in">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Approvals</h1>
          <p className="text-muted-foreground mt-1">
            {isVP ? "Review and finalize approval requests" : "Review pending approval requests"}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-warning/10 border border-warning/20">
            <Clock className="h-4 w-4 text-warning" />
            <span className="text-sm font-medium text-warning">{pendingRequests.length} Pending</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card className="animate-slide-up">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Pending Approvals</p>
                <p className="text-3xl font-display font-bold text-warning">{pendingRequests.length}</p>
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
                <p className="text-sm font-medium text-muted-foreground">Approved This Month</p>
                <p className="text-3xl font-display font-bold text-success">{approvedRequests.length}</p>
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
                <p className="text-sm font-medium text-muted-foreground">Rejected This Month</p>
                <p className="text-3xl font-display font-bold text-destructive">{rejectedRequests.length}</p>
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
                  Pending ({pendingRequests.length})
                </TabsTrigger>
                <TabsTrigger value="approved" className="gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Approved
                </TabsTrigger>
                <TabsTrigger value="rejected" className="gap-2">
                  <XCircle className="h-4 w-4" />
                  Rejected
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {activeTab === "pending" && (
            pendingRequests.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium">All caught up!</p>
                <p className="text-sm">No pending approvals at this time</p>
              </div>
            ) : (
              pendingRequests.map(request => renderRequestCard(request, true))
            )
          )}

          {activeTab === "approved" && (
            approvedRequests.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No approved requests</p>
              </div>
            ) : (
              approvedRequests.map(request => renderRequestCard(request, false))
            )
          )}

          {activeTab === "rejected" && (
            rejectedRequests.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No rejected requests</p>
              </div>
            ) : (
              rejectedRequests.map(request => renderRequestCard(request, false))
            )
          )}
        </CardContent>
      </Card>

      <RejectReasonDialog
        open={rejectDialogOpen}
        onOpenChange={setRejectDialogOpen}
        onConfirm={handleReject}
        employeeName={selectedRequest?.name || ""}
      />
    </DashboardLayout>
  );
};

export default Approvals;
