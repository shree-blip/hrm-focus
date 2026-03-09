import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, TrendingUp } from "lucide-react";
import { usePromotions } from "@/hooks/usePromotions";

interface RequestPromotionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: {
    id: string;
    first_name?: string;
    last_name?: string;
    name?: string;
    job_title?: string | null;
    role?: string;
    salary?: number | null;
  } | null;
}

export function RequestPromotionDialog({
  open,
  onOpenChange,
  employee,
}: RequestPromotionDialogProps) {
  const { createPromotionRequest } = usePromotions();
  const [newTitle, setNewTitle] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const employeeName =
    employee?.name ||
    `${employee?.first_name || ""} ${employee?.last_name || ""}`.trim();
  const currentTitle = employee?.job_title || employee?.role || "";
  const currentSalary = employee?.salary ?? null;

  const resetForm = () => {
    setNewTitle("");
    setEffectiveDate("");
    setReason("");
  };

  const handleSubmit = async () => {
    if (!employee?.id || !newTitle || !effectiveDate) return;
    setSubmitting(true);
    const success = await createPromotionRequest({
      employee_id: String(employee.id),
      current_title: currentTitle || null,
      current_salary: currentSalary,
      new_title: newTitle,
      effective_date: effectiveDate,
      reason: reason || undefined,
    });
    setSubmitting(false);
    if (success) {
      resetForm();
      onOpenChange(false);
    }
  };

  if (!employee) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <TrendingUp className="h-5 w-5 text-primary" />
            Request Promotion
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Employee info */}
          <div className="rounded-lg border p-3 bg-muted/30">
            <p className="text-sm font-medium">{employeeName}</p>
            <p className="text-xs text-muted-foreground">
              Current: {currentTitle || "N/A"}
              {currentSalary != null && ` | Salary: $${currentSalary.toLocaleString()}`}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-title">New Title *</Label>
            <Input
              id="new-title"
              placeholder="e.g. Senior Software Engineer"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="effective-date">Effective Date *</Label>
            <Input
              id="effective-date"
              type="date"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Reason / Notes</Label>
            <Textarea
              id="reason"
              placeholder="Briefly explain why this promotion is recommended..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              resetForm();
              onOpenChange(false);
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !newTitle || !effectiveDate}
          >
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Submit Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
