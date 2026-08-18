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
      <AlertDialogContent className="w-[calc(100vw-2rem)] max-w-lg max-h-[85vh] overflow-y-auto p-4 sm:p-6">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-start gap-2 text-base sm:text-lg break-words">
            ⚠️ Conflicting Leave Requests Detected
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 min-w-0">
              <p className="text-sm break-words">
                <strong>{employeeName}</strong> has submitted multiple pending leave requests with overlapping or either/or dates. Please clarify with the employee which dates they prefer before final approval.
              </p>

              <div className="space-y-2 min-w-0">
                <p className="text-sm font-medium text-foreground">Request you're approving:</p>
                <div className="p-2 rounded-md border border-primary/30 bg-primary/5 min-w-0">
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <span className="text-xs sm:text-sm font-medium break-words min-w-0">
                      {format(new Date(currentRequest.start_date), "MMM d, yyyy")} – {format(new Date(currentRequest.end_date), "MMM d, yyyy")}
                    </span>
                    <Badge variant="outline" className="text-xs shrink-0">{currentRequest.days} day{currentRequest.days !== 1 ? "s" : ""}</Badge>
                  </div>
                  <span className="text-xs text-muted-foreground break-words">{currentRequest.leave_type}</span>
                </div>

                <p className="text-sm font-medium text-foreground">Conflicting pending request(s):</p>
                {conflictingRequests.map((req) => (
                  <div key={req.id} className="p-2 rounded-md border border-warning/30 bg-warning/5 min-w-0">
                    <div className="flex flex-wrap items-center justify-between gap-1">
                      <span className="text-xs sm:text-sm font-medium break-words min-w-0">
                        {format(new Date(req.start_date), "MMM d, yyyy")} – {format(new Date(req.end_date), "MMM d, yyyy")}
                      </span>
                      <Badge variant="outline" className="text-xs border-warning text-warning shrink-0">{req.days} day{req.days !== 1 ? "s" : ""}</Badge>
                    </div>
                    <span className="text-xs text-muted-foreground break-words">{req.leave_type}</span>
                  </div>
                ))}
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row sm:flex-wrap gap-2">
          <AlertDialogCancel className="w-full sm:w-auto mt-0">Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onRejectOthers}
            className="w-full sm:w-auto bg-primary hover:bg-primary/90 whitespace-normal text-center"
          >
            Approve This & Reject Others
          </AlertDialogAction>
          <AlertDialogAction
            onClick={onApproveAnyway}
            className="w-full sm:w-auto border border-warning text-warning bg-transparent hover:bg-warning/10 whitespace-normal text-center"
          >
            Approve Without Resolving
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
