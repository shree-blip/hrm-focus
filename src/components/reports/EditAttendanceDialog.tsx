import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

interface EditAttendanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: {
    id: string;
    employee_name: string;
    clock_in: string;
    clock_out: string | null;
    break_start: string | null;
    break_end: string | null;
    total_break_minutes: number;
    pause_start: string | null;
    pause_end: string | null;
    total_pause_minutes: number | null;
  } | null;
  onSaved: () => void;
}

const toDatetimeLocal = (isoStr: string | null): string => {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
};

const fromDatetimeLocal = (localStr: string): string | null => {
  if (!localStr) return null;
  return new Date(localStr).toISOString();
};

export function EditAttendanceDialog({ open, onOpenChange, record, onSaved }: EditAttendanceDialogProps) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);

  const [clockIn, setClockIn] = useState("");
  const [clockOut, setClockOut] = useState("");
  const [breakStart, setBreakStart] = useState("");
  const [breakEnd, setBreakEnd] = useState("");
  const [pauseStart, setPauseStart] = useState("");
  const [pauseEnd, setPauseEnd] = useState("");
  const [reason, setReason] = useState("");

  // Reset form when record changes
  const resetForm = () => {
    if (record) {
      setClockIn(toDatetimeLocal(record.clock_in));
      setClockOut(toDatetimeLocal(record.clock_out));
      setBreakStart(toDatetimeLocal(record.break_start));
      setBreakEnd(toDatetimeLocal(record.break_end));
      setPauseStart(toDatetimeLocal(record.pause_start));
      setPauseEnd(toDatetimeLocal(record.pause_end));
      setReason("");
    }
  };

  // Use onOpenChange to reset
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen && record) {
      resetForm();
    }
    onOpenChange(isOpen);
  };

  // Also reset when dialog opens with a new record
  if (open && record && !clockIn) {
    resetForm();
  }

  const handleSave = async () => {
    if (!record || !user) return;
    if (!reason.trim()) {
      toast({ title: "Reason required", description: "Please provide a reason for the edit.", variant: "destructive" });
      return;
    }

    setSaving(true);

    try {
      // Build old values
      const oldValues = {
        clock_in: record.clock_in,
        clock_out: record.clock_out,
        break_start: record.break_start,
        break_end: record.break_end,
        total_break_minutes: record.total_break_minutes,
        pause_start: record.pause_start,
        pause_end: record.pause_end,
        total_pause_minutes: record.total_pause_minutes,
      };

      // Calculate new break/pause minutes
      let newBreakMinutes = 0;
      const newBreakStartIso = fromDatetimeLocal(breakStart);
      const newBreakEndIso = fromDatetimeLocal(breakEnd);
      if (newBreakStartIso && newBreakEndIso) {
        newBreakMinutes = Math.round((new Date(newBreakEndIso).getTime() - new Date(newBreakStartIso).getTime()) / 60000);
      }

      let newPauseMinutes = 0;
      const newPauseStartIso = fromDatetimeLocal(pauseStart);
      const newPauseEndIso = fromDatetimeLocal(pauseEnd);
      if (newPauseStartIso && newPauseEndIso) {
        newPauseMinutes = Math.round((new Date(newPauseEndIso).getTime() - new Date(newPauseStartIso).getTime()) / 60000);
      }

      const newClockInIso = fromDatetimeLocal(clockIn);
      const newClockOutIso = fromDatetimeLocal(clockOut);

      const newValues = {
        clock_in: newClockInIso,
        clock_out: newClockOutIso,
        break_start: newBreakStartIso,
        break_end: newBreakEndIso,
        total_break_minutes: Math.max(0, newBreakMinutes),
        pause_start: newPauseStartIso,
        pause_end: newPauseEndIso,
        total_pause_minutes: Math.max(0, newPauseMinutes),
      };

      // Update the attendance record
      const { error: updateError } = await supabase
        .from("attendance_logs")
        .update({
          clock_in: newValues.clock_in!,
          clock_out: newValues.clock_out,
          break_start: newValues.break_start,
          break_end: newValues.break_end,
          total_break_minutes: newValues.total_break_minutes,
          pause_start: newValues.pause_start,
          pause_end: newValues.pause_end,
          total_pause_minutes: newValues.total_pause_minutes,
          is_edited: true,
        })
        .eq("id", record.id);

      if (updateError) throw updateError;

      // Insert audit log
      const { error: auditError } = await supabase
        .from("attendance_edit_logs")
        .insert({
          attendance_id: record.id,
          edited_by: user.id,
          old_values: oldValues as any,
          new_values: newValues as any,
          reason: reason.trim(),
        });

      if (auditError) throw auditError;

      toast({ title: "Attendance Updated", description: `Record for ${record.employee_name} has been edited.` });
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      console.error("Error editing attendance:", err);
      toast({ title: "Error", description: err.message || "Failed to update attendance.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (!record) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Attendance — {record.employee_name}</DialogTitle>
          <DialogDescription>Modify attendance data. A reason is required and an audit log will be created.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Clock In</Label>
              <Input type="datetime-local" value={clockIn} onChange={(e) => setClockIn(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Clock Out</Label>
              <Input type="datetime-local" value={clockOut} onChange={(e) => setClockOut(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Break Start</Label>
              <Input type="datetime-local" value={breakStart} onChange={(e) => setBreakStart(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Break End</Label>
              <Input type="datetime-local" value={breakEnd} onChange={(e) => setBreakEnd(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Pause Start</Label>
              <Input type="datetime-local" value={pauseStart} onChange={(e) => setPauseStart(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Pause End</Label>
              <Input type="datetime-local" value={pauseEnd} onChange={(e) => setPauseEnd(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>
              Reason for Edit <span className="text-destructive">*</span>
            </Label>
            <Textarea
              placeholder="Explain why this record is being modified..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !reason.trim()}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
