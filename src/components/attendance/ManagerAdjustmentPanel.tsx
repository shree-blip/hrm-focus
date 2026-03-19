import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { format } from "date-fns";
import { ThumbsUp, ThumbsDown, ClipboardList, AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { AdjustmentRequest } from "@/hooks/useAttendanceAdjustments";

interface Props {
  requests: AdjustmentRequest[];
  onReview: (id: string, decision: "approved" | "rejected", comment: string) => Promise<boolean | undefined>;
}

export function ManagerAdjustmentPanel({ requests, onReview }: Props) {
  const [selectedRequest, setSelectedRequest] = useState<AdjustmentRequest | null>(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [rejectConfirm, setRejectConfirm] = useState<{ id: string; comment: string } | null>(null);

  const pending = requests.filter((r) => r.status === "pending");
  const reviewed = requests.filter((r) => r.status !== "pending");

  const handleDecision = async (decision: "approved" | "rejected") => {
    if (!selectedRequest || !comment.trim()) return;
    setSubmitting(true);
    const success = await onReview(selectedRequest.id, decision, comment);
    setSubmitting(false);
    if (success) {
      setSelectedRequest(null);
      setComment("");
    }
  };

  const formatTime = (iso: string | null) => {
    if (!iso) return "-";
    return format(new Date(iso), "hh:mm a");
  };

  if (requests.length === 0) return null;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            Attendance Adjustment Requests
            {pending.length > 0 && (
              <Badge variant="destructive" className="ml-1">
                {pending.length} pending
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pending.length === 0 && reviewed.length > 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No pending requests</p>
          ) : null}

          {pending.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Proposed Changes</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pending.map((req) => {
                  const empName = req.requester_profile
                    ? `${req.requester_profile.first_name} ${req.requester_profile.last_name}`
                    : "Employee";
                  const logDate = req.attendance_log?.clock_in
                    ? format(new Date(req.attendance_log.clock_in), "EEE, MMM d")
                    : "-";

                  return (
                    <TableRow key={req.id}>
                      <TableCell className="font-medium text-sm">{empName}</TableCell>
                      <TableCell className="text-sm">{logDate}</TableCell>
                      <TableCell className="text-xs space-y-0.5">
                        {req.proposed_clock_in && <p>Clock In → {formatTime(req.proposed_clock_in)}</p>}
                        {req.proposed_clock_out && <p>Clock Out → {formatTime(req.proposed_clock_out)}</p>}
                        {req.proposed_break_minutes != null && <p>Break → {req.proposed_break_minutes}m</p>}
                        {req.proposed_pause_minutes != null && <p>Pause → {req.proposed_pause_minutes}m</p>}
                      </TableCell>
                      <TableCell className="text-sm max-w-[200px] truncate">{req.reason}</TableCell>
                      <TableCell>
                        <Button size="sm" onClick={() => setSelectedRequest(req)}>
                          Review
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}

          {/* History */}
          {reviewed.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">History</p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reviewed By</TableHead>
                    <TableHead>Reviewed At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reviewed.slice(0, 10).map((req) => {
                    const empName = req.requester_profile
                      ? `${req.requester_profile.first_name} ${req.requester_profile.last_name}`
                      : "Employee";
                    const reviewerName = req.reviewer_profile
                      ? `${req.reviewer_profile.first_name} ${req.reviewer_profile.last_name}`
                      : "-";
                    return (
                      <TableRow key={req.id}>
                        <TableCell className="text-sm">{empName}</TableCell>
                        <TableCell className="text-sm">
                          {req.attendance_log?.clock_in ? format(new Date(req.attendance_log.clock_in), "MMM d") : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={req.status === "approved" ? "default" : "destructive"}>{req.status}</Badge>
                        </TableCell>
                        <TableCell className="text-sm font-medium">{reviewerName}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {req.reviewed_at ? format(new Date(req.reviewed_at), "MMM d, h:mm a") : "-"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Review Dialog */}
      <Dialog
        open={!!selectedRequest}
        onOpenChange={() => {
          setSelectedRequest(null);
          setComment("");
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Review Adjustment Request</DialogTitle>
            <DialogDescription>Approve or reject the attendance correction</DialogDescription>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4">
              {/* Employee & current vs proposed */}
              <div className="p-3 bg-muted rounded-lg text-sm space-y-2">
                <p className="font-medium">
                  {selectedRequest.requester_profile
                    ? `${selectedRequest.requester_profile.first_name} ${selectedRequest.requester_profile.last_name}`
                    : "Employee"}
                </p>

                {selectedRequest.attendance_log && (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <p className="text-muted-foreground">Current Clock In:</p>
                    <p>{formatTime(selectedRequest.attendance_log.clock_in)}</p>

                    {selectedRequest.proposed_clock_in && (
                      <>
                        <p className="text-muted-foreground">Proposed Clock In:</p>
                        <p className="text-blue-600 font-medium">{formatTime(selectedRequest.proposed_clock_in)}</p>
                      </>
                    )}

                    <p className="text-muted-foreground">Current Clock Out:</p>
                    <p>{formatTime(selectedRequest.attendance_log.clock_out)}</p>

                    {selectedRequest.proposed_clock_out && (
                      <>
                        <p className="text-muted-foreground">Proposed Clock Out:</p>
                        <p className="text-blue-600 font-medium">{formatTime(selectedRequest.proposed_clock_out)}</p>
                      </>
                    )}

                    {selectedRequest.proposed_break_minutes != null && (
                      <>
                        <p className="text-muted-foreground">Break:</p>
                        <p>
                          {selectedRequest.attendance_log.total_break_minutes || 0}m →{" "}
                          <span className="text-blue-600 font-medium">{selectedRequest.proposed_break_minutes}m</span>
                        </p>
                      </>
                    )}

                    {selectedRequest.proposed_pause_minutes != null && (
                      <>
                        <p className="text-muted-foreground">Pause:</p>
                        <p>
                          {selectedRequest.attendance_log.total_pause_minutes || 0}m →{" "}
                          <span className="text-blue-600 font-medium">{selectedRequest.proposed_pause_minutes}m</span>
                        </p>
                      </>
                    )}
                  </div>
                )}

                <div className="pt-1 border-t">
                  <p className="text-muted-foreground text-xs">Reason:</p>
                  <p className="text-sm">{selectedRequest.reason}</p>
                </div>
              </div>

              {/* Comment */}
              <div>
                <p className="text-sm font-medium mb-1">
                  Comment <span className="text-destructive">*</span>
                </p>
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Required comment..."
                  rows={2}
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  onClick={() => handleDecision("approved")}
                  disabled={!comment.trim() || submitting}
                >
                  <ThumbsUp className="h-4 w-4 mr-1" /> Approve
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => {
                    if (selectedRequest && comment.trim()) {
                      setRejectConfirm({ id: selectedRequest.id, comment: comment.trim() });
                    }
                  }}
                  disabled={!comment.trim() || submitting}
                >
                  <ThumbsDown className="h-4 w-4 mr-1" /> Reject
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
