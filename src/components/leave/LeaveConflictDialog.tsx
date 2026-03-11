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
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface ConflictingRequest {
  id: string;
  start_date: string;
  end_date: string;
  days: number;
  leave_type: string;
  reason: string | null;
}

interface LeaveConflictDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeName: string;
  currentRequest: ConflictingRequest | null;
  conflictingRequests: ConflictingRequest[];
  onApproveAnyway: () => void;
  onRejectOthers: () => void;
}

export function LeaveConflictDialog({
  open,
  onOpenChange,
  employeeName,
  currentRequest,
  conflictingRequests,
  onApproveAnyway,
  onRejectOthers,
}: LeaveConflictDialogProps) {
  if (!currentRequest) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            ⚠️ Conflicting Leave Requests Detected
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                <strong>{employeeName}</strong> has submitted multiple pending leave requests with overlapping or either/or dates. Please clarify with the employee which dates they prefer before final approval.
              </p>

              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Request you're approving:</p>
                <div className="p-2 rounded-md border border-primary/30 bg-primary/5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {format(new Date(currentRequest.start_date), "MMM d, yyyy")} – {format(new Date(currentRequest.end_date), "MMM d, yyyy")}
                    </span>
                    <Badge variant="outline" className="text-xs">{currentRequest.days} day{currentRequest.days !== 1 ? "s" : ""}</Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">{currentRequest.leave_type}</span>
                </div>

                <p className="text-sm font-medium text-foreground">Conflicting pending request(s):</p>
                {conflictingRequests.map((req) => (
                  <div key={req.id} className="p-2 rounded-md border border-warning/30 bg-warning/5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        {format(new Date(req.start_date), "MMM d, yyyy")} – {format(new Date(req.end_date), "MMM d, yyyy")}
                      </span>
                      <Badge variant="outline" className="text-xs border-warning text-warning">{req.days} day{req.days !== 1 ? "s" : ""}</Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">{req.leave_type}</span>
                  </div>
                ))}
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onRejectOthers}
            className="bg-primary hover:bg-primary/90"
          >
            Approve This & Reject Others
          </AlertDialogAction>
          <AlertDialogAction
            onClick={onApproveAnyway}
            variant="outline"
            className="border-warning text-warning hover:bg-warning/10"
          >
            Approve Without Resolving
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
