import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Check,
  X,
  Clock,
  Loader2,
  TrendingUp,
  CheckCircle2,
  XCircle,
  DollarSign,
  ArrowRight,
} from "lucide-react";
import { format } from "date-fns";
import { usePromotions, PromotionRequest } from "@/hooks/usePromotions";

export function PromotionApprovalQueue() {
  const {
    pendingApprovals,
    approvalHistory,
    approvePromotion,
    rejectPromotion,
    loading,
  } = usePromotions();

  const [activeTab, setActiveTab] = useState("pending");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<PromotionRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [approvalSalary, setApprovalSalary] = useState("");

  const approvedHistory = approvalHistory.filter((r) => r.status === "approved");
  const rejectedHistory = approvalHistory.filter((r) => r.status === "rejected");

  const handleOpenApprove = (request: PromotionRequest) => {
    setSelectedRequest(request);
    // Pre-fill with current salary if available
    setApprovalSalary(request.employee?.salary?.toString() || "");
    setApproveDialogOpen(true);
  };

  const handleConfirmApprove = async () => {
    if (!selectedRequest || !approvalSalary) return;
    setProcessingId(selectedRequest.id);
    await approvePromotion(selectedRequest.id, parseFloat(approvalSalary));
    setProcessingId(null);
    setApproveDialogOpen(false);
    setSelectedRequest(null);
    setApprovalSalary("");
  };

  const handleOpenReject = (request: PromotionRequest) => {
    setSelectedRequest(request);
    setRejectionReason("");
    setRejectDialogOpen(true);
  };

  const handleReject = async () => {
    if (!selectedRequest) return;
    setProcessingId(selectedRequest.id);
    await rejectPromotion(selectedRequest.id, rejectionReason || "Request denied");
    setProcessingId(null);
    setRejectDialogOpen(false);
    setSelectedRequest(null);
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { color: string; label: string }> = {
      pending: {
        color: "border-warning text-warning bg-warning/10",
        label: "Pending",
      },
      approved: {
        color: "border-success text-success bg-success/10",
        label: "Approved",
      },
      rejected: {
        color: "border-destructive text-destructive bg-destructive/10",
        label: "Rejected",
      },
    };
    const c = config[status] || config.pending;
    return (
      <Badge variant="outline" className={c.color}>
        {c.label}
      </Badge>
    );
  };

  const renderRequest = (
    request: PromotionRequest,
    showActions: boolean = false
  ) => {
    const emp = request.employee;
    const empName = emp
      ? `${emp.first_name} ${emp.last_name}`
      : "Unknown Employee";
    const initials = emp
      ? `${emp.first_name?.[0] || ""}${emp.last_name?.[0] || ""}`.toUpperCase()
      : "??";
    const isProcessing = processingId === request.id;

    return (
      <div
        key={request.id}
        className="flex items-start gap-4 p-4 rounded-xl bg-accent/30 border border-border hover:border-primary/20 transition-all"
      >
        <Avatar className="h-10 w-10">
          <AvatarFallback className="bg-primary/10 text-primary font-medium">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="font-medium">{empName}</p>
              {emp?.department && (
                <p className="text-xs text-muted-foreground">
                  {emp.department}
                </p>
              )}
              {/* Title change */}
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">
                  {request.current_title || "N/A"}
                </span>
                <ArrowRight className="h-3 w-3 text-primary" />
                <span className="font-medium">{request.new_title}</span>
              </div>
              {/* Salary info */}
              <div className="flex items-center gap-2 text-sm">
                <DollarSign className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">
                  Current: {request.current_salary != null
                    ? `Rs. ${request.current_salary.toLocaleString()}`
                    : "N/A"}
                </span>
                {request.new_salary != null && request.status !== "pending" && (
                  <>
                    <ArrowRight className="h-3 w-3 text-primary" />
                    <span className="font-medium text-success">
                      Rs. {request.new_salary.toLocaleString()}
                    </span>
                    {request.current_salary != null && request.current_salary > 0 && (
                      <span className="text-xs text-success">
                        (+{(((request.new_salary - request.current_salary) / request.current_salary) * 100).toFixed(1)}%)
                      </span>
                    )}
                  </>
                )}
                {request.status === "pending" && (
                  <span className="text-xs text-muted-foreground italic">— New salary set on approval</span>
                )}
              </div>
              {/* Effective date */}
              <p className="text-xs text-muted-foreground">
                Effective:{" "}
                {format(new Date(request.effective_date), "MMM d, yyyy")}
              </p>
              {request.reason && (
                <p className="text-sm text-muted-foreground mt-1 italic">
                  "{request.reason}"
                </p>
              )}
              {request.rejection_reason && (
                <div className="flex items-start gap-2 mt-2 p-2 rounded-lg bg-destructive/10 border border-destructive/20">
                  <p className="text-sm text-destructive">
                    <span className="font-medium">Reason:</span>{" "}
                    {request.rejection_reason}
                  </p>
                </div>
              )}
            </div>
            <div className="flex flex-col items-end gap-2">
              {getStatusBadge(request.status)}
              <span className="text-xs text-muted-foreground">
                {format(new Date(request.created_at), "MMM d, yyyy")}
              </span>
            </div>
          </div>

          {showActions && (
            <div className="flex gap-2 mt-3">
              <Button
                size="sm"
                className="gap-1"
                onClick={() => handleOpenApprove(request)}
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
                onClick={() => handleOpenReject(request)}
                disabled={isProcessing}
              >
                <X className="h-3 w-3" />
                Reject
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4">
            <CardTitle className="font-display text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Promotion Requests
            </CardTitle>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="flex-wrap h-auto gap-1">
                <TabsTrigger value="pending" className="gap-2">
                  <Clock className="h-4 w-4" />
                  Pending ({pendingApprovals.length})
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
          {activeTab === "pending" &&
            (pendingApprovals.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium">All caught up!</p>
                <p className="text-sm">No pending promotion requests</p>
              </div>
            ) : (
              pendingApprovals.map((r) => renderRequest(r, true))
            ))}

          {activeTab === "approved" &&
            (approvedHistory.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No approved promotions yet</p>
              </div>
            ) : (
              approvedHistory.map((r) => renderRequest(r, false))
            ))}

          {activeTab === "rejected" &&
            (rejectedHistory.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No rejected promotions</p>
              </div>
            ) : (
              rejectedHistory.map((r) => renderRequest(r, false))
            ))}
        </CardContent>
      </Card>

      {/* Approval dialog — VP/Admin sets salary before approving */}
      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Approve Promotion
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {selectedRequest?.employee && (
              <div className="rounded-lg border p-3 bg-muted/30 space-y-1">
                <p className="text-sm font-medium">
                  {selectedRequest.employee.first_name}{" "}
                  {selectedRequest.employee.last_name}
                </p>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">
                    {selectedRequest.current_title || "N/A"}
                  </span>
                  <ArrowRight className="h-3 w-3 text-primary" />
                  <span className="font-medium">{selectedRequest.new_title}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Current Salary: Rs. {(selectedRequest.employee.salary ?? 0).toLocaleString()}
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="approval-salary">New Salary (NPR) *</Label>
              <Input
                id="approval-salary"
                type="number"
                min="0"
                placeholder="Enter the new salary"
                value={approvalSalary}
                onChange={(e) => setApprovalSalary(e.target.value)}
              />
              {selectedRequest?.employee?.salary != null && approvalSalary && (
                <p className="text-xs text-muted-foreground">
                  Change:{" "}
                  <span
                    className={
                      parseFloat(approvalSalary) >= (selectedRequest.employee.salary ?? 0)
                        ? "text-success"
                        : "text-destructive"
                    }
                  >
                    {parseFloat(approvalSalary) >= (selectedRequest.employee.salary ?? 0) ? "+" : ""}
                    {selectedRequest.employee.salary
                      ? (((parseFloat(approvalSalary) - selectedRequest.employee.salary) / selectedRequest.employee.salary) * 100).toFixed(1)
                      : "0"}%
                  </span>
                </p>
              )}
            </div>

            {selectedRequest?.reason && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Manager's Note</Label>
                <p className="text-sm italic text-muted-foreground">"{selectedRequest.reason}"</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirmApprove}
              disabled={!approvalSalary || parseFloat(approvalSalary) <= 0 || processingId === selectedRequest?.id}
            >
              {processingId === selectedRequest?.id ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Approve & Update Salary
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rejection reason dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Promotion Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {selectedRequest?.employee && (
              <p className="text-sm text-muted-foreground">
                Rejecting promotion for{" "}
                <span className="font-medium text-foreground">
                  {selectedRequest.employee.first_name}{" "}
                  {selectedRequest.employee.last_name}
                </span>
              </p>
            )}
            <div className="space-y-2">
              <Label htmlFor="reject-reason">Reason for rejection</Label>
              <Textarea
                id="reject-reason"
                placeholder="Provide a reason for rejecting this request..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRejectDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={processingId === selectedRequest?.id}
            >
              {processingId === selectedRequest?.id ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <X className="h-4 w-4 mr-2" />
              )}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
