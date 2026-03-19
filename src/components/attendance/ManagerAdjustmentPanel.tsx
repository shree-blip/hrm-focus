import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { format } from "date-fns";
import { ThumbsUp, ThumbsDown, ClipboardList, AlertTriangle, ShieldAlert } from "lucide-react";
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
  onOverride?: (id: string, decision: "approved" | "rejected", comment: string) => Promise<boolean | undefined>;
  canOverride?: boolean;
}

export function ManagerAdjustmentPanel({ requests, onReview, onOverride, canOverride }: Props) {
  const [selectedRequest, setSelectedRequest] = useState<AdjustmentRequest | null>(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [rejectConfirm, setRejectConfirm] = useState<{ id: string; comment: string } | null>(null);
  const [overrideDialog, setOverrideDialog] = useState<{ req: AdjustmentRequest } | null>(null);
  const [overrideComment, setOverrideComment] = useState("");
  const [overrideDecision, setOverrideDecision] = useState<"approved" | "rejected">("rejected");

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
                    {canOverride && <TableHead className="text-right">Override</TableHead>}
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
                    const overriderName = (req as any).override_profile
                      ? `${(req as any).override_profile.first_name} ${(req as any).override_profile.last_name}`
                      : null;

                    return (
                      <TableRow key={req.id}>
                        <TableCell className="text-sm">{empName}</TableCell>
                        <TableCell className="text-sm">
                          <div className="flex flex-col gap-0.5">
                            <span>
                              {req.attendance_log?.clock_in
                                ? format(new Date(req.attendance_log.clock_in), "EEE, MMM d")
                                : "-"}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              Requested: {format(new Date(req.created_at), "MMM d, h:mm a")}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Badge variant={req.status === "approved" ? "default" : "destructive"}>{req.status}</Badge>
                            {req.override_status && (
                              <Badge variant="outline" className="text-xs border-amber-500 text-amber-600 bg-amber-50">
                                Overridden
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium">{reviewerName}</span>
                            {overriderName && (
                              <span className="text-xs text-amber-600">Override by {overriderName}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {req.reviewed_at ? format(new Date(req.reviewed_at), "MMM d, h:mm a") : "-"}
                          {req.override_at && (
                            <p className="text-amber-600">
                              Override: {format(new Date(req.override_at), "MMM d, h:mm a")}
                            </p>
                          )}
                        </TableCell>
                        {canOverride && (
                          <TableCell className="text-right">
                            {req.override_status ? (
                              <Badge variant="outline" className="text-xs capitalize border-amber-500 text-amber-600">
                                {req.override_status}
                              </Badge>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs gap-1 border-amber-400 text-amber-600 hover:bg-amber-50"
                                onClick={() => {
                                  setOverrideDialog({ req });
                                  setOverrideComment("");
                                  // Pre-select the opposite of current status
                                  setOverrideDecision(req.status === "approved" ? "rejected" : "approved");
                                }}
                              >
                                <ShieldAlert className="h-3 w-3" />
                                Override
                              </Button>
                            )}
                          </TableCell>
                        )}
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
                    <p>
                      {format(new Date(selectedRequest.attendance_log.clock_in), "MMM d")} —{" "}
                      {formatTime(selectedRequest.attendance_log.clock_in)}
                    </p>

                    {selectedRequest.proposed_clock_in && (
                      <>
                        <p className="text-muted-foreground">Proposed Clock In:</p>
                        <p className="text-blue-600 font-medium">
                          {format(new Date(selectedRequest.proposed_clock_in), "MMM d")} —{" "}
                          {formatTime(selectedRequest.proposed_clock_in)}
                        </p>
                      </>
                    )}

                    <p className="text-muted-foreground">Current Clock Out:</p>
                    <p>
                      {selectedRequest.attendance_log.clock_out
                        ? `${format(new Date(selectedRequest.attendance_log.clock_out), "MMM d")} — ${formatTime(selectedRequest.attendance_log.clock_out)}`
                        : "-"}
                    </p>

                    {selectedRequest.proposed_clock_out && (
                      <>
                        <p className="text-muted-foreground">Proposed Clock Out:</p>
                        <p className="text-blue-600 font-medium">
                          {format(new Date(selectedRequest.proposed_clock_out), "MMM d")} —{" "}
                          {formatTime(selectedRequest.proposed_clock_out)}
                        </p>
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

      {/* Reject Confirmation Dialog */}
      <AlertDialog
        open={!!rejectConfirm}
        onOpenChange={(open) => {
          if (!open) setRejectConfirm(null);
        }}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
              <AlertTriangle className="h-7 w-7 text-red-600" />
            </div>
            <AlertDialogTitle className="text-center text-xl">Are you sure you want to reject?</AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              This will reject the employee's attendance adjustment request. They will be notified of the decision.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2 mt-4">
            <AlertDialogCancel className="flex-1">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              onClick={async () => {
                if (rejectConfirm) {
                  setSubmitting(true);
                  const success = await onReview(rejectConfirm.id, "rejected", rejectConfirm.comment);
                  setSubmitting(false);
                  if (success) {
                    setRejectConfirm(null);
                    setSelectedRequest(null);
                    setComment("");
                  }
                }
              }}
            >
              Confirm Reject
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Override Dialog (CEO/Admin only) */}
      <AlertDialog
        open={!!overrideDialog}
        onOpenChange={(open) => {
          if (!open) {
            setOverrideDialog(null);
            setOverrideComment("");
          }
        }}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
              <ShieldAlert className="h-7 w-7 text-amber-600" />
            </div>
            <AlertDialogTitle className="text-center text-lg">Override Decision</AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              {overrideDialog?.req.requester_profile
                ? `${overrideDialog.req.requester_profile.first_name} ${overrideDialog.req.requester_profile.last_name}'s request — currently "${overrideDialog.req.status}" by line manager.`
                : `This request is currently "${overrideDialog?.req.status}".`}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-3 pt-2">
            {/* Show original reviewer's comment */}
            {/* Show full adjustment details */}
            {overrideDialog?.req && (
              <div className="p-3 bg-muted rounded-lg text-xs space-y-2">
                {/* Attendance date */}
                {overrideDialog.req.attendance_log?.clock_in && (
                  <p className="font-medium text-sm">
                    {format(new Date(overrideDialog.req.attendance_log.clock_in), "EEEE, MMM d, yyyy")}
                  </p>
                )}

                {/* Current vs Proposed values */}
                {overrideDialog.req.attendance_log && (
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                    <p className="text-muted-foreground">Current Clock In:</p>
                    <p>
                      {format(new Date(overrideDialog.req.attendance_log.clock_in), "MMM d")} —{" "}
                      {formatTime(overrideDialog.req.attendance_log.clock_in)}
                    </p>

                    {overrideDialog.req.proposed_clock_in && (
                      <>
                        <p className="text-muted-foreground">Proposed Clock In:</p>
                        <p className="text-blue-600 font-medium">
                          {format(new Date(overrideDialog.req.proposed_clock_in), "MMM d")} —{" "}
                          {formatTime(overrideDialog.req.proposed_clock_in)}
                        </p>
                      </>
                    )}

                    <p className="text-muted-foreground">Current Clock Out:</p>
                    <p>
                      {overrideDialog.req.attendance_log.clock_out
                        ? `${format(new Date(overrideDialog.req.attendance_log.clock_out), "MMM d")} — ${formatTime(overrideDialog.req.attendance_log.clock_out)}`
                        : "-"}
                    </p>

                    {overrideDialog.req.proposed_clock_out && (
                      <>
                        <p className="text-muted-foreground">Proposed Clock Out:</p>
                        <p className="text-blue-600 font-medium">
                          {format(new Date(overrideDialog.req.proposed_clock_out), "MMM d")} —{" "}
                          {formatTime(overrideDialog.req.proposed_clock_out)}
                        </p>
                      </>
                    )}

                    {overrideDialog.req.proposed_break_minutes != null && (
                      <>
                        <p className="text-muted-foreground">Break:</p>
                        <p>
                          {overrideDialog.req.attendance_log.total_break_minutes || 0}m →{" "}
                          <span className="text-blue-600 font-medium">
                            {overrideDialog.req.proposed_break_minutes}m
                          </span>
                        </p>
                      </>
                    )}

                    {overrideDialog.req.proposed_pause_minutes != null && (
                      <>
                        <p className="text-muted-foreground">Pause:</p>
                        <p>
                          {overrideDialog.req.attendance_log.total_pause_minutes || 0}m →{" "}
                          <span className="text-blue-600 font-medium">
                            {overrideDialog.req.proposed_pause_minutes}m
                          </span>
                        </p>
                      </>
                    )}
                  </div>
                )}

                {/* Employee's reason */}
                <div className="pt-1 border-t">
                  <p className="text-muted-foreground">Employee's Reason:</p>
                  <p className="text-sm mt-0.5">{overrideDialog.req.reason}</p>
                </div>

                {/* Line manager's decision & comment */}
                <div className="pt-1 border-t">
                  <div className="flex items-center gap-2">
                    <p className="text-muted-foreground">Line Manager:</p>
                    <Badge
                      variant={overrideDialog.req.status === "approved" ? "default" : "destructive"}
                      className="text-xs capitalize"
                    >
                      {overrideDialog.req.status}
                    </Badge>
                  </div>
                  {overrideDialog.req.reviewer_comment && (
                    <p className="text-sm mt-0.5">{overrideDialog.req.reviewer_comment}</p>
                  )}
                </div>
              </div>
            )}

            <div>
              <p className="text-sm font-medium mb-1">Override to:</p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={overrideDecision === "approved" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setOverrideDecision("approved")}
                >
                  <ThumbsUp className="h-3 w-3 mr-1" /> Approve
                </Button>
                <Button
                  size="sm"
                  variant={overrideDecision === "rejected" ? "destructive" : "outline"}
                  className="flex-1"
                  onClick={() => setOverrideDecision("rejected")}
                >
                  <ThumbsDown className="h-3 w-3 mr-1" /> Reject
                </Button>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium mb-1">
                Reason <span className="text-destructive">*</span>
              </p>
              <Textarea
                value={overrideComment}
                onChange={(e) => setOverrideComment(e.target.value)}
                placeholder="Reason for overriding the line manager's decision..."
                rows={2}
              />
            </div>
          </div>

          <AlertDialogFooter className="flex-col sm:flex-row gap-2 mt-4">
            <AlertDialogCancel className="flex-1">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
              disabled={!overrideComment.trim() || submitting}
              onClick={async () => {
                if (overrideDialog && onOverride && overrideComment.trim()) {
                  setSubmitting(true);
                  const success = await onOverride(overrideDialog.req.id, overrideDecision, overrideComment.trim());
                  setSubmitting(false);
                  if (success) {
                    setOverrideDialog(null);
                    setOverrideComment("");
                  }
                }
              }}
            >
              Confirm Override
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
