import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Coffee, Pause, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toNPT, toPST } from "@/utils/timezone";
import { useBreakSessions, type BreakSession } from "@/hooks/useBreakSessions";

interface AttendanceLog {
  id: string;
  clock_in: string;
  clock_out: string | null;
  total_break_minutes: number;
  total_pause_minutes?: number;
  break_start?: string | null;
  break_end?: string | null;
  pause_start?: string | null;
  pause_end?: string | null;
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

interface EditableSession {
  id: string;
  session_type: "break" | "pause";
  start: string; // datetime-local string "yyyy-MM-ddTHH:mm"
  end: string;   // "" if ongoing
  originalStart: string | null;
  originalEnd: string | null;
}

const toLocalInput = (iso: string | null): string => {
  if (!iso) return "";
  try {
    return format(new Date(iso), "yyyy-MM-dd'T'HH:mm");
  } catch {
    return "";
  }
};

const diffMinutes = (start: string, end: string): number => {
  if (!start || !end) return 0;
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (isNaN(s) || isNaN(e) || e <= s) return 0;
  return Math.round((e - s) / 60000);
};

export function AdjustmentRequestDialog({ log, open, onOpenChange, onSubmit }: Props) {
  const clockInDate = new Date(log.clock_in);
  const clockOutDate = log.clock_out ? new Date(log.clock_out) : null;

  const [clockInDateStr, setClockInDateStr] = useState(format(clockInDate, "yyyy-MM-dd"));
  const [clockIn, setClockIn] = useState(format(clockInDate, "HH:mm"));
  const [clockOutDateStr, setClockOutDateStr] = useState(
    clockOutDate ? format(clockOutDate, "yyyy-MM-dd") : format(clockInDate, "yyyy-MM-dd"),
  );
  const [clockOut, setClockOut] = useState(clockOutDate ? format(clockOutDate, "HH:mm") : "");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editableSessions, setEditableSessions] = useState<EditableSession[]>([]);

  const { fetchSessions, getSessions, isLoading } = useBreakSessions();
  const fetched = getSessions(log.id);
  const sessionsLoading = isLoading(log.id);

  useEffect(() => {
    if (open) fetchSessions(log.id);
  }, [open, log.id, fetchSessions]);

  // Hydrate editable sessions whenever fetched data arrives
  useEffect(() => {
    if (!open) return;
    let source: BreakSession[] = fetched || [];
    // Fall back to legacy single-record data if no per-session rows exist
    if ((!source || source.length === 0) && !sessionsLoading) {
      const legacy: BreakSession[] = [];
      if (log.break_start && (log.total_break_minutes || 0) > 0) {
        legacy.push({
          id: "legacy-break",
          attendance_log_id: log.id,
          session_type: "break",
          start_time: log.break_start,
          end_time: log.break_end || null,
          duration_minutes: log.total_break_minutes || null,
        });
      }
      if (log.pause_start && (log.total_pause_minutes || 0) > 0) {
        legacy.push({
          id: "legacy-pause",
          attendance_log_id: log.id,
          session_type: "pause",
          start_time: log.pause_start,
          end_time: log.pause_end || null,
          duration_minutes: log.total_pause_minutes || null,
        });
      }
      source = legacy;
    }

    setEditableSessions(
      source.map((s) => ({
        id: s.id,
        session_type: s.session_type as "break" | "pause",
        start: toLocalInput(s.start_time),
        end: toLocalInput(s.end_time),
        originalStart: s.start_time,
        originalEnd: s.end_time,
      })),
    );
  }, [fetched, sessionsLoading, open, log]);

  const updateSession = (id: string, field: "start" | "end", value: string) => {
    setEditableSessions((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
  };

  const totals = useMemo(() => {
    let breakMin = 0;
    let pauseMin = 0;
    for (const s of editableSessions) {
      const d = diffMinutes(s.start, s.end);
      if (s.session_type === "break") breakMin += d;
      else pauseMin += d;
    }
    return { breakMin, pauseMin };
  }, [editableSessions]);

  const handleSubmit = async () => {
    if (!reason.trim()) return;
    setSubmitting(true);

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

    if (totals.breakMin !== (log.total_break_minutes || 0)) {
      proposed.proposed_break_minutes = totals.breakMin;
    }
    if (totals.pauseMin !== (log.total_pause_minutes || 0)) {
      proposed.proposed_pause_minutes = totals.pauseMin;
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
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
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
          </div>

          {/* Clock in/out edit */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="adj-clock-in-date">Clock In Date</Label>
              <Input id="adj-clock-in-date" type="date" value={clockInDateStr} onChange={(e) => setClockInDateStr(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="adj-clock-in">Clock In Time</Label>
              <Input id="adj-clock-in" type="time" value={clockIn} onChange={(e) => setClockIn(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="adj-clock-out-date">Clock Out Date</Label>
              <Input id="adj-clock-out-date" type="date" value={clockOutDateStr} onChange={(e) => setClockOutDateStr(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="adj-clock-out">Clock Out Time</Label>
              <Input id="adj-clock-out" type="time" value={clockOut} onChange={(e) => setClockOut(e.target.value)} />
            </div>
          </div>

          {/* Editable Break / Pause sessions */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
                Break & Pause Sessions
              </p>
              <p className="text-xs text-muted-foreground">
                New totals: <span className="font-medium text-warning">{totals.breakMin}m break</span> ·{" "}
                <span className="font-medium text-info">{totals.pauseMin}m pause</span>
              </p>
            </div>

            {sessionsLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : editableSessions.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2 text-center border rounded-md">
                No break or pause sessions recorded for this log.
              </p>
            ) : (
              <div className="rounded-md border overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/50 border-b">
                      <th className="text-left px-2 py-1.5 font-medium text-muted-foreground w-6">#</th>
                      <th className="text-left px-2 py-1.5 font-medium text-muted-foreground">Type</th>
                      <th className="text-left px-2 py-1.5 font-medium text-muted-foreground">Start</th>
                      <th className="text-left px-2 py-1.5 font-medium text-muted-foreground">End</th>
                      <th className="text-left px-2 py-1.5 font-medium text-muted-foreground">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {editableSessions.map((s, idx) => {
                      const dur = diffMinutes(s.start, s.end);
                      return (
                        <tr key={s.id} className="border-b last:border-0">
                          <td className="px-2 py-1.5 text-muted-foreground">{idx + 1}</td>
                          <td className="px-2 py-1.5">
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] px-1.5 py-0",
                                s.session_type === "break"
                                  ? "border-warning text-warning bg-warning/10"
                                  : "border-info text-info bg-info/10",
                              )}
                            >
                              {s.session_type === "break" ? (
                                <><Coffee className="h-2.5 w-2.5 mr-0.5" />Break</>
                              ) : (
                                <><Pause className="h-2.5 w-2.5 mr-0.5" />Pause</>
                              )}
                            </Badge>
                          </td>
                          <td className="px-2 py-1.5">
                            <Input
                              type="datetime-local"
                              value={s.start}
                              onChange={(e) => updateSession(s.id, "start", e.target.value)}
                              className="h-7 text-xs px-2"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <Input
                              type="datetime-local"
                              value={s.end}
                              onChange={(e) => updateSession(s.id, "end", e.target.value)}
                              className="h-7 text-xs px-2"
                            />
                          </td>
                          <td className="px-2 py-1.5 font-medium font-mono">
                            {dur > 0 ? `${dur}m` : "-"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-[11px] text-muted-foreground">
              Edit each session's Start/End — durations and totals recalculate automatically.
            </p>
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
              placeholder="e.g., Forgot to end break, actual break ended at 1:30 PM"
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
