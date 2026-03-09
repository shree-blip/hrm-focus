import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calculator } from "lucide-react";
import { PayrollDateRangePicker } from "@/components/payroll/PayrollDateRangePicker";
import { subMonths, startOfMonth, endOfMonth, differenceInDays, isAfter } from "date-fns";

interface RunPayrollDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRun: (startDate: Date, endDate: Date) => void;
  isProcessing: boolean;
}

export function RunPayrollDialog({ open, onOpenChange, onRun, isProcessing }: RunPayrollDialogProps) {
  const lastMonth = subMonths(new Date(), 1);
  const [range, setRange] = useState<{ from: Date; to: Date } | null>({
    from: startOfMonth(lastMonth),
    to: endOfMonth(lastMonth),
  });

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);

  const isValid = range
    ? !isAfter(range.to, yesterday) && !isAfter(range.from, range.to) && differenceInDays(range.to, range.from) <= 31
    : false;

  const handleRun = () => {
    if (!isValid || !range) return;
    onRun(range.from, range.to);
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
            Select a date range for the pay period. The end date must be before today (only completed periods).
          </p>

          <PayrollDateRangePicker value={range} onChange={setRange} />
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
