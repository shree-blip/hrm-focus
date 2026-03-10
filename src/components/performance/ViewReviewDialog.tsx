import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Star } from "lucide-react";
import type { PerformanceReview } from "@/hooks/usePerformanceReviews";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  review: PerformanceReview | null;
  onAcknowledge?: (id: string) => Promise<void>;
  canAcknowledge?: boolean;
}

function Stars({ value }: { value: number | null }) {
  if (!value) return <span className="text-muted-foreground text-sm">—</span>;
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <Star key={n} className={`h-4 w-4 ${n <= value ? "text-warning fill-warning" : "text-muted-foreground/20"}`} />
      ))}
      <span className="ml-1 text-sm text-muted-foreground">{value}/5</span>
    </div>
  );
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  acknowledged: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
};

export function ViewReviewDialog({ open, onOpenChange, review, onAcknowledge, canAcknowledge }: Props) {
  if (!review) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Performance Review</DialogTitle>
          <DialogDescription>
            {review.employee_name} • {review.period_start} to {review.period_end}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Reviewer</p>
              <p className="font-medium">{review.reviewer_name}</p>
            </div>
            <Badge className={STATUS_COLORS[review.status] || ""}>{review.status}</Badge>
          </div>

          <div className="rounded-lg border p-3 space-y-2">
            <p className="font-semibold text-sm">Ratings</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Quality</p>
                <Stars value={review.quality_rating} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Communication</p>
                <Stars value={review.communication_rating} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Ownership</p>
                <Stars value={review.ownership_rating} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Collaboration</p>
                <Stars value={review.collaboration_rating} />
              </div>
            </div>
            {review.final_score !== null && (
              <p className="text-sm pt-1 border-t">
                Final Score: <strong>{review.final_score}</strong>/100
              </p>
            )}
          </div>

          {review.strengths && (
            <div>
              <p className="text-sm font-medium">Strengths</p>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{review.strengths}</p>
            </div>
          )}
          {review.improvements && (
            <div>
              <p className="text-sm font-medium">Areas for Improvement</p>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{review.improvements}</p>
            </div>
          )}
          {review.comments && (
            <div>
              <p className="text-sm font-medium">Comments</p>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{review.comments}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          {canAcknowledge && review.status === "submitted" && onAcknowledge && (
            <Button onClick={() => onAcknowledge(review.id)}>Acknowledge</Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
