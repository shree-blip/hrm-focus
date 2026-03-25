import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useAssetRequests } from "@/hooks/useAssetRequests";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { Plus, Package, Monitor, Check, X, Loader2, Clock, ShieldCheck, UserCheck, AlertCircle } from "lucide-react";
import { format } from "date-fns";

export function AssetRequestsSection() {
  const { assetRequests, loading, submitAssetRequest, lineManagerApprove, adminApprove, declineRequest } = useAssetRequests();
  const { user, isVP, isAdmin } = useAuth();
  const { hasPermission } = usePermissions();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [requestType, setRequestType] = useState<"asset" | "it_support">("asset");
  const [submitting, setSubmitting] = useState(false);
  const [declineDialogOpen, setDeclineDialogOpen] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState("");
  const [filter, setFilter] = useState("all");

  const isSuperUser = isVP || isAdmin;

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim()) return;
    setSubmitting(true);
    const result = await submitAssetRequest(title, description, requestType);
    setSubmitting(false);
    if (result.success) {
      setTitle("");
      setDescription("");
      setRequestType("asset");
      setIsDialogOpen(false);
    }
  };

  const handleDeclineClick = (requestId: string) => {
    setSelectedRequestId(requestId);
    setDeclineReason("");
    setDeclineDialogOpen(true);
  };

  const handleDeclineConfirm = async () => {
    if (selectedRequestId) {
      await declineRequest(selectedRequestId, declineReason);
      setDeclineDialogOpen(false);
      setSelectedRequestId(null);
      setDeclineReason("");
    }
  };

  // Determine user's role context for this view
  const isLineManagerView = useMemo(() => {
    return assetRequests.some(
      (r) => r.user_id !== user?.id && (r.approval_stage === "pending_line_manager")
    );
  }, [assetRequests, user]);

  const filteredRequests = useMemo(() => {
    let filtered = assetRequests;
    if (filter === "pending_my_approval") {
      filtered = filtered.filter((r) => r.approval_stage === "pending_line_manager" && r.user_id !== user?.id);
    } else if (filter === "approved_by_me") {
      filtered = filtered.filter((r) => r.line_manager_approved_by && r.user_id !== user?.id && r.approval_stage !== "pending_line_manager");
    } else if (filter === "pending_admin") {
      filtered = filtered.filter((r) => r.approval_stage === "pending_admin");
    } else if (filter === "my_requests") {
      filtered = filtered.filter((r) => r.user_id === user?.id);
    }
    return filtered;
  }, [assetRequests, filter, user]);

  const getStatusBadge = (request: any) => {
    switch (request.approval_stage) {
      case "pending_line_manager":
        return <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400"><Clock className="h-3 w-3 mr-1" />Pending Line Manager</Badge>;
      case "pending_admin":
        return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400"><ShieldCheck className="h-3 w-3 mr-1" />Pending Admin</Badge>;
      case "approved":
        return <Badge className="bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400"><Check className="h-3 w-3 mr-1" />Approved</Badge>;
      case "declined":
        return <Badge className="bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400"><X className="h-3 w-3 mr-1" />Declined</Badge>;
      default:
        return <Badge variant="outline">{request.approval_stage}</Badge>;
    }
  };

  const getTypeIcon = (type: string) =>
    type === "it_support" ? <Monitor className="h-4 w-4" /> : <Package className="h-4 w-4" />;

  const getTypeLabel = (type: string) =>
    type === "it_support" ? "IT Support" : "Asset Request";

  // Check if current user can act as LM for a request
  const canActAsLineManager = (request: any) =>
    request.approval_stage === "pending_line_manager" && request.user_id !== user?.id;

  // Check if current user can act as admin for a request
  const canActAsAdmin = (request: any) =>
    request.approval_stage === "pending_admin" && isSuperUser;

  return (
    <div className="space-y-6">
      {/* Submit Request Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Request Assets / IT Support
          </CardTitle>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />New Request</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader><DialogTitle>Submit Request</DialogTitle></DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Request Type</Label>
                  <Select value={requestType} onValueChange={(v: "asset" | "it_support") => setRequestType(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="asset"><div className="flex items-center gap-2"><Package className="h-4 w-4" />Asset Request</div></SelectItem>
                      <SelectItem value="it_support"><div className="flex items-center gap-2"><Monitor className="h-4 w-4" />IT Support</div></SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input id="title" placeholder="What do you need?" value={title} onChange={(e) => setTitle(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea id="description" placeholder="Provide details about your request..." rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
                </div>
                <Button className="w-full" onClick={handleSubmit} disabled={!title.trim() || !description.trim() || submitting}>
                  {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Submitting...</> : "Submit Request"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Need equipment, software, or IT support? Submit a request here. It will be reviewed by your Line Manager first, then Admin.
          </p>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle>Requests</CardTitle>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Filter..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Visible</SelectItem>
                <SelectItem value="my_requests">My Requests</SelectItem>
                {isLineManagerView && (
                  <>
                    <SelectItem value="pending_my_approval">Pending My Approval</SelectItem>
                    <SelectItem value="approved_by_me">Approved by Me</SelectItem>
                  </>
                )}
                {isSuperUser && <SelectItem value="pending_admin">Pending Admin Review</SelectItem>}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredRequests.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No requests found</p>
          ) : (
            <div className="space-y-4">
              {filteredRequests.map((request) => (
                <div key={request.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {getTypeIcon(request.request_type)}
                        <h4 className="font-medium">{request.title}</h4>
                        <Badge variant="outline" className="text-xs">{getTypeLabel(request.request_type)}</Badge>
                      </div>
                      {request.user_id !== user?.id && (
                        <p className="text-sm text-muted-foreground">
                          Requested by: {request.requester_name} ({request.requester_email})
                          {request.requester_department && ` • ${request.requester_department}`}
                        </p>
                      )}
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(request.created_at), "MMM d, yyyy 'at' h:mm a")}
                      </p>
                    </div>
                    {getStatusBadge(request)}
                  </div>

                  <p className="text-sm">{request.description}</p>

                  {/* Approval Trail */}
                  <div className="border-t pt-3 space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Approval Trail</p>
                    <div className="flex items-center gap-2 text-sm">
                      <UserCheck className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>Submitted by {request.requester_name}</span>
                    </div>
                    {request.line_manager_approved_at && (
                      <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                        <Check className="h-3.5 w-3.5" />
                        <span>
                          Line Manager {request.line_manager_name || "approved"} on{" "}
                          {format(new Date(request.line_manager_approved_at), "MMM d, yyyy")}
                        </span>
                      </div>
                    )}
                    {request.admin_approved_at && (
                      <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        <span>
                          Admin {request.admin_approver_name || "approved"} on{" "}
                          {format(new Date(request.admin_approved_at), "MMM d, yyyy")}
                        </span>
                      </div>
                    )}
                    {request.approval_stage === "declined" && (
                      <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                        <X className="h-3.5 w-3.5" />
                        <span>
                          Declined{request.approver_name ? ` by ${request.approver_name}` : ""} on{" "}
                          {request.approved_at ? format(new Date(request.approved_at), "MMM d, yyyy") : ""}
                        </span>
                      </div>
                    )}
                    {request.rejection_reason && (
                      <p className="text-sm text-red-500 ml-5">Reason: {request.rejection_reason}</p>
                    )}
                  </div>

                  {/* Action Buttons */}
                  {canActAsLineManager(request) && (
                    <div className="flex items-center gap-2 pt-2 border-t">
                      <Button size="sm" onClick={() => lineManagerApprove(request.id)}>
                        <Check className="h-4 w-4 mr-1" />Approve & Forward to Admin
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleDeclineClick(request.id)}>
                        <X className="h-4 w-4 mr-1" />Decline
                      </Button>
                    </div>
                  )}

                  {canActAsAdmin(request) && (
                    <div className="flex items-center gap-2 pt-2 border-t">
                      <Button size="sm" onClick={() => adminApprove(request.id)}>
                        <ShieldCheck className="h-4 w-4 mr-1" />Admin Approve
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleDeclineClick(request.id)}>
                        <X className="h-4 w-4 mr-1" />Decline
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Decline Reason Dialog */}
      <Dialog open={declineDialogOpen} onOpenChange={setDeclineDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader><DialogTitle>Decline Request</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reason">Reason (optional)</Label>
              <Textarea id="reason" placeholder="Provide a reason for declining..." rows={3} value={declineReason} onChange={(e) => setDeclineReason(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeclineDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeclineConfirm}>Decline Request</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
