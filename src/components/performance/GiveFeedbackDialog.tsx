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
import type { CreateFeedbackInput, Feedback360 } from "@/hooks/usePerformanceReviews";

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employees: Employee[];
  onSubmit: (input: CreateFeedbackInput) => Promise<void>;
}

const CATEGORIES: { value: Feedback360["category"]; label: string }[] = [
  { value: "quality", label: "Quality of Work" },
  { value: "communication", label: "Communication" },
  { value: "ownership", label: "Ownership / Initiative" },
  { value: "collaboration", label: "Collaboration" },
  { value: "leadership", label: "Leadership" },
  { value: "technical", label: "Technical Skills" },
];

export function GiveFeedbackDialog({ open, onOpenChange, employees, onSubmit }: Props) {
  const [employeeId, setEmployeeId] = useState("");
  const [category, setCategory] = useState<Feedback360["category"] | "">("");
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = employeeId && category && rating > 0;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    await onSubmit({
      to_employee_id: employeeId,
      category: category as Feedback360["category"],
      rating,
      comment: comment || undefined,
    });
    setSubmitting(false);
    resetForm();
    onOpenChange(false);
  }

  function resetForm() {
    setEmployeeId("");
    setCategory("");
    setRating(0);
    setComment("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Give 360° Feedback</DialogTitle>
          <DialogDescription>Provide anonymous peer feedback for a colleague.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>Employee</Label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger><SelectValue placeholder="Select colleague" /></SelectTrigger>
              <SelectContent>
                {employees.map(e => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.first_name} {e.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Category</Label>
            <Select value={category} onValueChange={v => setCategory(v as Feedback360["category"])}>
              <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(c => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Rating</Label>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} type="button" onClick={() => setRating(n)} className="p-0.5">
                  <Star className={`h-6 w-6 ${n <= rating ? "text-warning fill-warning" : "text-muted-foreground/30"}`} />
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <Label>Comment (optional)</Label>
            <Textarea value={comment} onChange={e => setComment(e.target.value)} rows={3} placeholder="Your feedback..." />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || submitting}>Submit</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
