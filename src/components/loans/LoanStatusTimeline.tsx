import { cn } from "@/lib/utils";
import { CheckCircle2, Circle, Clock, XCircle, AlertTriangle } from "lucide-react";
import { LOAN_STATUSES, STATUS_LABELS, LoanStatus } from "@/lib/loanCalculations";

interface LoanStatusTimelineProps {
  currentStatus: string;
}

const statusIcons: Record<string, typeof CheckCircle2> = {
  rejected: XCircle,
  deferred: AlertTriangle,
};

export function LoanStatusTimeline({ currentStatus }: LoanStatusTimelineProps) {
  const currentIndex = LOAN_STATUSES.indexOf(currentStatus as LoanStatus);
  const isRejected = currentStatus === 'rejected';
  const isDeferred = currentStatus === 'deferred';

  const displayStatuses = LOAN_STATUSES.filter(s => s !== 'rejected' && s !== 'deferred');

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Status Timeline</p>
      {(isRejected || isDeferred) && (
        <div className={cn("flex items-center gap-2 p-2 rounded-lg text-sm", isRejected ? "bg-destructive/10 text-destructive" : "bg-yellow-500/10 text-yellow-600")}>
          {isRejected ? <XCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          <span className="font-medium">{isRejected ? 'Rejected' : 'Deferred to Waiting List'}</span>
        </div>
      )}
      <div className="flex items-center gap-1 overflow-x-auto pb-2">
        {displayStatuses.map((status, i) => {
          const statusIndex = LOAN_STATUSES.indexOf(status);
          const isPast = !isRejected && !isDeferred && statusIndex < currentIndex;
          const isCurrent = status === currentStatus;
          const Icon = isCurrent ? Clock : isPast ? CheckCircle2 : Circle;

          return (
            <div key={status} className="flex items-center">
              <div className={cn("flex flex-col items-center min-w-[60px]")}>
                <Icon className={cn("h-4 w-4 mb-1",
                  isPast && "text-green-500",
                  isCurrent && "text-primary",
                  !isPast && !isCurrent && "text-muted-foreground/40"
                )} />
                <span className={cn("text-[10px] text-center leading-tight",
                  isCurrent && "font-bold text-primary",
                  isPast && "text-green-600",
                  !isPast && !isCurrent && "text-muted-foreground/50"
                )}>
                  {STATUS_LABELS[status]}
                </span>
              </div>
              {i < displayStatuses.length - 1 && (
                <div className={cn("h-[2px] w-4 mt-[-12px]",
                  isPast ? "bg-green-500" : "bg-muted-foreground/20"
                )} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
