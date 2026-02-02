import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAssetRequests } from "@/hooks/useAssetRequests";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, Package, Monitor, Check, X, Loader2 } from "lucide-react";
import { format } from "date-fns";

export function AssetRequestsSection() {
  const { assetRequests, loading, submitAssetRequest, approveRequest, declineRequest } = useAssetRequests();
  const { user, isManager, isVP, isAdmin } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [requestType, setRequestType] = useState<"asset" | "it_support">("asset");
  const [submitting, setSubmitting] = useState(false);
  const [declineDialogOpen, setDeclineDialogOpen] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState("");

  const canApprove = isManager || isVP || isAdmin;

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

  const handleApprove = async (requestId: string) => {
    await approveRequest(requestId);
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400";
      case "approved":
        return "bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400";
      case "declined":
        return "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getTypeIcon = (type: string) => {
    return type === "it_support" ? (
      <Monitor className="h-4 w-4" />
    ) : (
      <Package className="h-4 w-4" />
    );
  };

  const getTypeLabel = (type: string) => {
    return type === "it_support" ? "IT Support" : "Asset Request";
  };

  // Filter requests - show all for managers, only own for regular users
  const filteredRequests = canApprove
    ? assetRequests
    : assetRequests.filter((r) => r.user_id === user?.id);

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
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Request
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Submit Request</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Request Type</Label>
                  <Select
                    value={requestType}
                    onValueChange={(value: "asset" | "it_support") => setRequestType(value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="asset">
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4" />
                          Asset Request
                        </div>
                      </SelectItem>
                      <SelectItem value="it_support">
                        <div className="flex items-center gap-2">
                          <Monitor className="h-4 w-4" />
                          IT Support
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    placeholder="What do you need?"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Provide details about your request..."
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={handleSubmit}
                  disabled={!title.trim() || !description.trim() || submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Submit Request"
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Need equipment, software, or IT support? Submit a request here.
          </p>
        </CardContent>
      </Card>

      {/* Requests List */}
      <Card>
        <CardHeader>
          <CardTitle>
            {canApprove ? "All Requests" : "My Requests"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredRequests.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No requests found
            </p>
          ) : (
            <div className="space-y-4">
              {filteredRequests.map((request) => (
                <div
                  key={request.id}
                  className="border rounded-lg p-4 space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {getTypeIcon(request.request_type)}
                        <h4 className="font-medium">{request.title}</h4>
                        <Badge variant="outline" className="text-xs">
                          {getTypeLabel(request.request_type)}
                        </Badge>
                      </div>
                      {canApprove && request.user_id !== user?.id && (
                        <p className="text-sm text-muted-foreground">
                          Requested by: {request.requester_name} ({request.requester_email})
                        </p>
                      )}
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(request.created_at), "MMM d, yyyy 'at' h:mm a")}
                      </p>
                    </div>
                    <Badge className={getStatusColor(request.status)}>
                      {request.status}
                    </Badge>
                  </div>
                  <p className="text-sm">{request.description}</p>
                  
                  {request.status === "approved" && request.approver_name && (
                    <p className="text-sm text-green-600 dark:text-green-400">
                      Approved by {request.approver_name} on{" "}
                      {format(new Date(request.approved_at!), "MMM d, yyyy")}
                    </p>
                  )}
                  
                  {request.status === "declined" && (
                    <div className="text-sm text-red-600 dark:text-red-400">
                      <p>
                        Declined by {request.approver_name} on{" "}
                        {format(new Date(request.approved_at!), "MMM d, yyyy")}
                      </p>
                      {request.rejection_reason && (
                        <p className="mt-1">Reason: {request.rejection_reason}</p>
                      )}
                    </div>
                  )}

                  {canApprove && request.status === "pending" && request.user_id !== user?.id && (
                    <div className="flex items-center gap-2 pt-2">
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => handleApprove(request.id)}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeclineClick(request.id)}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Decline
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
          <DialogHeader>
            <DialogTitle>Decline Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reason">Reason (optional)</Label>
              <Textarea
                id="reason"
                placeholder="Provide a reason for declining..."
                rows={3}
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeclineDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeclineConfirm}>
              Decline Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
