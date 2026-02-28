import { cn } from "@/lib/utils";
import { CheckCircle2, Circle, Clock, XCircle } from "lucide-react";
import { SIMPLIFIED_STATUSES, SIMPLIFIED_STATUS_LABELS, SimplifiedLoanStatus } from "@/lib/loanCalculations";

interface LoanStatusTimelineProps {
  currentStatus: string;
}

export function LoanStatusTimeline({ currentStatus }: LoanStatusTimelineProps) {
  const currentIndex = SIMPLIFIED_STATUSES.indexOf(currentStatus as SimplifiedLoanStatus);
  const isRejected = currentStatus === 'rejected';

  const displayStatuses = SIMPLIFIED_STATUSES.filter(s => s !== 'rejected');

  return (
    <div className="space-y-2">
      {isRejected && (
        <div className="flex items-center gap-2 p-2 rounded-lg text-sm bg-destructive/10 text-destructive">
          <XCircle className="h-4 w-4" />
          <span className="font-medium">Rejected</span>
        </div>
      )}
      <div className="flex items-center gap-1 overflow-x-auto pb-2">
        {displayStatuses.map((status, i) => {
          const statusIndex = SIMPLIFIED_STATUSES.indexOf(status);
          const isPast = !isRejected && statusIndex < currentIndex;
          const isCurrent = status === currentStatus;
          const Icon = isCurrent ? Clock : isPast ? CheckCircle2 : Circle;

          return (
            <div key={status} className="flex items-center">
              <div className="flex flex-col items-center min-w-[70px]">
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
                  {SIMPLIFIED_STATUS_LABELS[status]}
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
