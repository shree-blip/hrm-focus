import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";

interface AttendanceLog {
  id: string;
  clock_in: string;
  clock_out: string | null;
  total_break_minutes: number;
  total_pause_minutes?: number;
}

interface Props {
  log: AttendanceLog;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    attendance_log_id: string;
    proposed_clock_in?: string;
    proposed_clock_out?: string;
    proposed_break_minutes?: number;
    proposed_pause_minutes?: number;
    reason: string;
  }) => Promise<boolean | undefined>;
}

export function AdjustmentRequestDialog({ log, open, onOpenChange, onSubmit }: Props) {
  const clockInDate = new Date(log.clock_in);
  const dateStr = format(clockInDate, "yyyy-MM-dd");

  // Pre-fill with current values
  const [clockIn, setClockIn] = useState(format(clockInDate, "HH:mm"));
  const [clockOut, setClockOut] = useState(
    log.clock_out ? format(new Date(log.clock_out), "HH:mm") : "",
  );
  const [breakMinutes, setBreakMinutes] = useState(log.total_break_minutes || 0);
  const [pauseMinutes, setPauseMinutes] = useState((log as any).total_pause_minutes || 0);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!reason.trim()) return;
    setSubmitting(true);

    // Build proposed values — only include fields that changed
    const proposed: any = {
      attendance_log_id: log.id,
      reason: reason.trim(),
    };

    const originalClockIn = format(clockInDate, "HH:mm");
    const originalClockOut = log.clock_out ? format(new Date(log.clock_out), "HH:mm") : "";

    if (clockIn !== originalClockIn) {
      proposed.proposed_clock_in = new Date(`${dateStr}T${clockIn}:00`).toISOString();
    }

    if (clockOut !== originalClockOut && clockOut) {
      proposed.proposed_clock_out = new Date(`${dateStr}T${clockOut}:00`).toISOString();
    }

    if (breakMinutes !== (log.total_break_minutes || 0)) {
      proposed.proposed_break_minutes = breakMinutes;
    }

    if (pauseMinutes !== ((log as any).total_pause_minutes || 0)) {
      proposed.proposed_pause_minutes = pauseMinutes;
    }

    const success = await onSubmit(proposed);
    setSubmitting(false);
    if (success) {
      onOpenChange(false);
      setReason("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request Attendance Adjustment</DialogTitle>
          <DialogDescription>
            Correct your attendance for {format(clockInDate, "EEEE, MMM d, yyyy")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Current values summary */}
          <div className="p-3 bg-muted rounded-lg text-sm space-y-1">
            <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">Current Values</p>
            <p><strong>Clock In:</strong> {format(clockInDate, "hh:mm a")}</p>
            <p><strong>Clock Out:</strong> {log.clock_out ? format(new Date(log.clock_out), "hh:mm a") : "Not clocked out"}</p>
            <p><strong>Break:</strong> {log.total_break_minutes || 0} min</p>
            <p><strong>Pause:</strong> {(log as any).total_pause_minutes || 0} min</p>
          </div>

          {/* Corrected values */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="adj-clock-in">Clock In</Label>
              <Input
                id="adj-clock-in"
                type="time"
                value={clockIn}
                onChange={(e) => setClockIn(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="adj-clock-out">Clock Out</Label>
              <Input
                id="adj-clock-out"
                type="time"
                value={clockOut}
                onChange={(e) => setClockOut(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="adj-break">Break (minutes)</Label>
              <Input
                id="adj-break"
                type="number"
                min={0}
                max={480}
                value={breakMinutes}
                onChange={(e) => setBreakMinutes(parseInt(e.target.value) || 0)}
              />
            </div>
            <div>
              <Label htmlFor="adj-pause">Pause (minutes)</Label>
              <Input
                id="adj-pause"
                type="number"
                min={0}
                max={480}
                value={pauseMinutes}
                onChange={(e) => setPauseMinutes(parseInt(e.target.value) || 0)}
              />
            </div>
          </div>

          {/* Reason */}
          <div>
            <Label htmlFor="adj-reason">
              Reason <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="adj-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Forgot to clock out, actual departure was 6:00 PM"
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleSubmit}
              disabled={!reason.trim() || submitting}
            >
              {submitting ? "Submitting..." : "Submit Request"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
