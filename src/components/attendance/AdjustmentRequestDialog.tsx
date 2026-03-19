import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { toNPT, toPST } from "@/utils/timezone";

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
  const clockOutDate = log.clock_out ? new Date(log.clock_out) : null;

  // Pre-fill with current values (date + time separately)
  const [clockInDateStr, setClockInDateStr] = useState(format(clockInDate, "yyyy-MM-dd"));
  const [clockIn, setClockIn] = useState(format(clockInDate, "HH:mm"));
  const [clockOutDateStr, setClockOutDateStr] = useState(
    clockOutDate ? format(clockOutDate, "yyyy-MM-dd") : format(clockInDate, "yyyy-MM-dd"),
  );
  const [clockOut, setClockOut] = useState(clockOutDate ? format(clockOutDate, "HH:mm") : "");
  const [breakMinutes, setBreakMinutes] = useState(log.total_break_minutes || 0);
  const [pauseMinutes, setPauseMinutes] = useState(log.total_pause_minutes || 0);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!reason.trim()) return;
    setSubmitting(true);

    // Build proposed values — only include fields that changed
    const proposed: {
      attendance_log_id: string;
      reason: string;
      proposed_clock_in?: string;
      proposed_clock_out?: string;
      proposed_break_minutes?: number;
      proposed_pause_minutes?: number;
    } = {
      attendance_log_id: log.id,
      reason: reason.trim(),
    };

    const originalClockInDate = format(clockInDate, "yyyy-MM-dd");
    const originalClockIn = format(clockInDate, "HH:mm");
    const originalClockOutDate = clockOutDate ? format(clockOutDate, "yyyy-MM-dd") : "";
    const originalClockOut = clockOutDate ? format(clockOutDate, "HH:mm") : "";

    if (clockIn !== originalClockIn || clockInDateStr !== originalClockInDate) {
      proposed.proposed_clock_in = new Date(`${clockInDateStr}T${clockIn}:00`).toISOString();
    }

    if ((clockOut !== originalClockOut || clockOutDateStr !== originalClockOutDate) && clockOut) {
      proposed.proposed_clock_out = new Date(`${clockOutDateStr}T${clockOut}:00`).toISOString();
    }

    if (breakMinutes !== (log.total_break_minutes || 0)) {
      proposed.proposed_break_minutes = breakMinutes;
    }

    if (pauseMinutes !== (log.total_pause_minutes || 0)) {
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
          <DialogDescription>Correct your attendance for {format(clockInDate, "EEEE, MMM d, yyyy")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Current values summary */}
          <div className="p-3 bg-muted rounded-lg text-sm space-y-1">
            <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">Current Values</p>
            <p>
              <strong>Clock In:</strong> {toNPT(log.clock_in)} / {toPST(log.clock_in)}
            </p>
            <p>
              <strong>Clock Out:</strong>{" "}
              {log.clock_out ? `${toNPT(log.clock_out)} / ${toPST(log.clock_out)}` : "Not clocked out"}
            </p>
            <p>
              <strong>Break:</strong> {log.total_break_minutes || 0} min
            </p>
            <p>
              <strong>Pause:</strong> {log.total_pause_minutes || 0} min
            </p>
          </div>

          {/* Corrected values */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="adj-clock-in-date">Clock In Date</Label>
              <Input
                id="adj-clock-in-date"
                type="date"
                value={clockInDateStr}
                onChange={(e) => setClockInDateStr(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="adj-clock-in">Clock In Time</Label>
              <Input id="adj-clock-in" type="time" value={clockIn} onChange={(e) => setClockIn(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="adj-clock-out-date">Clock Out Date</Label>
              <Input
                id="adj-clock-out-date"
                type="date"
                value={clockOutDateStr}
                onChange={(e) => setClockOutDateStr(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="adj-clock-out">Clock Out Time</Label>
              <Input id="adj-clock-out" type="time" value={clockOut} onChange={(e) => setClockOut(e.target.value)} />
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
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={handleSubmit} disabled={!reason.trim() || submitting}>
              {submitting ? "Submitting..." : "Submit Request"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
