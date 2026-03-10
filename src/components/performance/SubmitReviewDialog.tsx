import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Star } from "lucide-react";
import type { CreateReviewInput } from "@/hooks/usePerformanceReviews";

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employees: Employee[];
  onSubmit: (input: CreateReviewInput) => Promise<void>;
}

const RATING_LABELS = ["", "Poor", "Below Average", "Average", "Good", "Excellent"];

function RatingPicker({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-sm font-medium">{label}</Label>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className="p-0.5 transition-colors"
          >
            <Star
              className={`h-5 w-5 ${n <= value ? "text-warning fill-warning" : "text-muted-foreground/30"}`}
            />
          </button>
        ))}
        <span className="ml-2 text-xs text-muted-foreground">{RATING_LABELS[value] || ""}</span>
      </div>
    </div>
  );
}

export function SubmitReviewDialog({ open, onOpenChange, employees, onSubmit }: Props) {
  const [employeeId, setEmployeeId] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [quality, setQuality] = useState(0);
  const [communication, setCommunication] = useState(0);
  const [ownership, setOwnership] = useState(0);
  const [collaboration, setCollaboration] = useState(0);
  const [strengths, setStrengths] = useState("");
  const [improvements, setImprovements] = useState("");
  const [comments, setComments] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const ratings = [quality, communication, ownership, collaboration].filter(r => r > 0);
  const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
  const finalScore = ratings.length > 0 ? Math.round((avgRating / 5) * 100) : 0;

  const canSubmit = employeeId && periodStart && periodEnd && ratings.length === 4;

  async function handleSubmit(asDraft: boolean) {
    if (!employeeId || !periodStart || !periodEnd) return;
    setSubmitting(true);
    await onSubmit({
      employee_id: employeeId,
      period_start: periodStart,
      period_end: periodEnd,
      quality_rating: quality || undefined,
      communication_rating: communication || undefined,
      ownership_rating: ownership || undefined,
      collaboration_rating: collaboration || undefined,
      final_score: finalScore || undefined,
      strengths: strengths || undefined,
      improvements: improvements || undefined,
      comments: comments || undefined,
      status: asDraft ? "draft" : "submitted",
    });
    setSubmitting(false);
    resetForm();
    onOpenChange(false);
  }

  function resetForm() {
    setEmployeeId("");
    setPeriodStart("");
    setPeriodEnd("");
    setQuality(0);
    setCommunication(0);
    setOwnership(0);
    setCollaboration(0);
    setStrengths("");
    setImprovements("");
    setComments("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Submit Performance Review</DialogTitle>
          <DialogDescription>Rate an employee across four dimensions and provide qualitative feedback.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Employee */}
          <div className="space-y-1">
            <Label>Employee</Label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
              <SelectContent>
                {employees.map(e => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.first_name} {e.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Period */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Period Start</Label>
              <input
                type="date"
                value={periodStart}
                onChange={e => setPeriodStart(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label>Period End</Label>
              <input
                type="date"
                value={periodEnd}
                onChange={e => setPeriodEnd(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>

          {/* Ratings */}
          <div className="space-y-3 rounded-lg border p-3">
            <p className="text-sm font-semibold">Ratings (1-5)</p>
            <RatingPicker label="Quality of Work" value={quality} onChange={setQuality} />
            <RatingPicker label="Communication" value={communication} onChange={setCommunication} />
            <RatingPicker label="Ownership / Initiative" value={ownership} onChange={setOwnership} />
            <RatingPicker label="Collaboration" value={collaboration} onChange={setCollaboration} />
            {ratings.length === 4 && (
              <p className="text-sm text-muted-foreground">
                Average: {avgRating.toFixed(1)}/5 → Final Score: <strong>{finalScore}</strong>/100
              </p>
            )}
          </div>

          {/* Qualitative */}
          <div className="space-y-1">
            <Label>Strengths</Label>
            <Textarea value={strengths} onChange={e => setStrengths(e.target.value)} rows={2} placeholder="Key strengths observed..." />
          </div>
          <div className="space-y-1">
            <Label>Areas for Improvement</Label>
            <Textarea value={improvements} onChange={e => setImprovements(e.target.value)} rows={2} placeholder="Areas that need work..." />
          </div>
          <div className="space-y-1">
            <Label>Additional Comments</Label>
            <Textarea value={comments} onChange={e => setComments(e.target.value)} rows={2} placeholder="Any other observations..." />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => handleSubmit(true)} disabled={!employeeId || !periodStart || !periodEnd || submitting}>
            Save Draft
          </Button>
          <Button onClick={() => handleSubmit(false)} disabled={!canSubmit || submitting}>
            Submit Review
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
