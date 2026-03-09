import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Calculator } from "lucide-react";

interface RunPayrollDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRun: (startDate: Date, endDate: Date) => void;
  isProcessing: boolean;
}

export function RunPayrollDialog({ open, onOpenChange, onRun, isProcessing }: RunPayrollDialogProps) {
  const today = new Date();
  // Default to 1st - last day of previous month
  const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
  const lastMonthStart = new Date(lastMonthEnd.getFullYear(), lastMonthEnd.getMonth(), 1);

  const formatDate = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const [startDate, setStartDate] = useState(formatDate(lastMonthStart));
  const [endDate, setEndDate] = useState(formatDate(lastMonthEnd));

  const todayStr = formatDate(today);

  // Validation
  const start = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T00:00:00");
  const endIsInFuture = endDate >= todayStr;
  const startAfterEnd = start > end;
  const rangeTooLong = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24) > 31;
  const isValid = startDate && endDate && !endIsInFuture && !startAfterEnd && !rangeTooLong;

  // Calculate days in range
  const daysInRange = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  const handleRun = () => {
    if (!isValid) return;
    onRun(start, end);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Run Payroll - Select Pay Period
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            Select a custom date range for the pay period. The end date must be before today (only completed periods).
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>End Date</Label>
              <Input
                type="date"
                value={endDate}
                max={formatDate(new Date(today.getTime() - 86400000))} // yesterday
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          {isValid && (
            <div className="rounded-lg bg-secondary/50 p-3 text-sm">
              <p><strong>Pay Period:</strong> {daysInRange} days</p>
              <p className="text-muted-foreground mt-1">
                Salary will be prorated: (Monthly Gross ÷ Standard Hours) × Payable Hours
              </p>
            </div>
          )}

          {endIsInFuture && (
            <div className="flex items-center gap-2 text-destructive text-sm">
              <AlertCircle className="h-4 w-4" />
              End date must be before today. Only completed pay periods allowed.
            </div>
          )}
          {startAfterEnd && (
            <div className="flex items-center gap-2 text-destructive text-sm">
              <AlertCircle className="h-4 w-4" />
              Start date cannot be after end date.
            </div>
          )}
          {rangeTooLong && (
            <div className="flex items-center gap-2 text-destructive text-sm">
              <AlertCircle className="h-4 w-4" />
              Pay period cannot exceed 31 days.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleRun} disabled={!isValid || isProcessing}>
            {isProcessing ? "Processing..." : "Run Payroll"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
