/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect } from "react";
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
import { Loader2, Plus, Trash2, Coffee, Pause } from "lucide-react";
import { cn } from "@/lib/utils";

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

interface SessionRow {
  /** DB id or null for new rows */
  dbId: string | null;
  sessionType: "break" | "pause";
  startTime: string; // datetime-local value
  endTime: string;
  /** Mark for deletion on save */
  deleted?: boolean;
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

const formatTimeShort = (isoStr: string | null): string => {
  if (!isoStr) return "-";
  return new Date(isoStr).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
};

function calcMinutes(startLocal: string, endLocal: string): number {
  const s = fromDatetimeLocal(startLocal);
  const e = fromDatetimeLocal(endLocal);
  if (!s || !e) return 0;
  return Math.max(0, Math.round((new Date(e).getTime() - new Date(s).getTime()) / 60000));
}

export function EditAttendanceDialog({ open, onOpenChange, record, onSaved }: EditAttendanceDialogProps) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [clockIn, setClockIn] = useState("");
  const [clockOut, setClockOut] = useState("");
  const [reason, setReason] = useState("");
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  const loadSessions = async (logId: string) => {
    setLoadingSessions(true);
    const { data, error } = await supabase
      .from("attendance_break_sessions")
      .select("id, session_type, start_time, end_time")
      .eq("attendance_log_id", logId)
      .order("start_time", { ascending: true });

    if (!error && data && data.length > 0) {
      setSessions(
        data.map((s) => ({
          dbId: s.id,
          sessionType: s.session_type as "break" | "pause",
          startTime: toDatetimeLocal(s.start_time),
          endTime: toDatetimeLocal(s.end_time),
        })),
      );
    } else {
      // Fall back to legacy single fields
      const legacy: SessionRow[] = [];
      if (record?.break_start) {
        legacy.push({
          dbId: null,
          sessionType: "break",
          startTime: toDatetimeLocal(record.break_start),
          endTime: toDatetimeLocal(record.break_end),
        });
      }
      if (record?.pause_start) {
        legacy.push({
          dbId: null,
          sessionType: "pause",
          startTime: toDatetimeLocal(record.pause_start),
          endTime: toDatetimeLocal(record.pause_end),
        });
      }
      setSessions(legacy);
    }
    setLoadingSessions(false);
  };

  const resetForm = () => {
    if (record) {
      setClockIn(toDatetimeLocal(record.clock_in));
      setClockOut(toDatetimeLocal(record.clock_out));
      setReason("");
      setConfirmDelete(false);
      setSessions([]);
      loadSessions(record.id);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen && record) {
      resetForm();
    }
    onOpenChange(isOpen);
  };

  useEffect(() => {
    if (open && record) {
      resetForm();
    }
  }, [record?.id]);

  const updateSession = (idx: number, field: keyof Pick<SessionRow, "startTime" | "endTime">, value: string) => {
    setSessions((prev) => prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s)));
  };

  const removeSession = (idx: number) => {
    setSessions((prev) => prev.map((s, i) => (i === idx ? { ...s, deleted: true } : s)));
  };

  const addSession = (type: "break" | "pause") => {
    setSessions((prev) => [...prev, { dbId: null, sessionType: type, startTime: "", endTime: "" }]);
  };

  const visibleSessions = sessions.filter((s) => !s.deleted);
  const visibleBreaks = visibleSessions.filter((s) => s.sessionType === "break");
  const visiblePauses = visibleSessions.filter((s) => s.sessionType === "pause");

  const handleDelete = async () => {
    if (!record || !user) return;
    if (!reason.trim()) {
      toast({ title: "Reason required", description: "Please provide a reason for deletion.", variant: "destructive" });
      return;
    }

    setDeleting(true);
    try {
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

      await supabase.from("attendance_edit_logs").insert({
        attendance_id: record.id,
        edited_by: user.id,
        old_values: oldValues as any,
        new_values: { action: "deleted" } as any,
        reason: `[DELETED] ${reason.trim()}`,
      });

      // Delete break sessions first (FK constraint)
      await supabase.from("attendance_break_sessions").delete().eq("attendance_log_id", record.id);

      const { error } = await supabase.from("attendance_logs").delete().eq("id", record.id);
      if (error) throw error;

      const { data: editorProfile } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("user_id", user.id)
        .single();

      const editorName = editorProfile ? `${editorProfile.first_name} ${editorProfile.last_name}` : "A manager";
      const editDate = new Date(record.clock_in).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });

      const { data: vpUsers } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "vp" as any);

      if (vpUsers?.length) {
        for (const vp of vpUsers) {
          if (vp.user_id !== user.id) {
            await supabase.rpc("create_notification", {
              p_user_id: vp.user_id,
              p_title: "🗑️ Attendance Deleted",
              p_message: `${editorName} deleted attendance for ${record.employee_name} on ${editDate}. Reason: ${reason.trim()}`,
              p_type: "warning",
              p_link: "/reports",
            });
          }
        }
      }

      toast({ title: "Record Deleted", description: `Attendance for ${record.employee_name} has been deleted.` });
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      console.error("Error deleting attendance:", err);
      toast({ title: "Error", description: err.message || "Failed to delete.", variant: "destructive" });
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const handleSave = async () => {
    if (!record || !user) return;
    if (!reason.trim()) {
      toast({ title: "Reason required", description: "Please provide a reason for the edit.", variant: "destructive" });
      return;
    }

    setSaving(true);

    try {
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

      const newClockInIso = fromDatetimeLocal(clockIn);
      const newClockOutIso = fromDatetimeLocal(clockOut);

      // ---- Recalculate totals from active sessions ----
      const activeSessions = sessions.filter((s) => !s.deleted && s.startTime);
      const totalBreakMin = activeSessions
        .filter((s) => s.sessionType === "break")
        .reduce((sum, s) => sum + calcMinutes(s.startTime, s.endTime), 0);
      const totalPauseMin = activeSessions
        .filter((s) => s.sessionType === "pause")
        .reduce((sum, s) => sum + calcMinutes(s.startTime, s.endTime), 0);

      // Determine legacy fields from first break/pause session
      const firstBreak = activeSessions.find((s) => s.sessionType === "break");
      const firstPause = activeSessions.find((s) => s.sessionType === "pause");

      const newValues = {
        clock_in: newClockInIso,
        clock_out: newClockOutIso,
        break_start: firstBreak ? fromDatetimeLocal(firstBreak.startTime) : null,
        break_end: firstBreak ? fromDatetimeLocal(firstBreak.endTime) : null,
        total_break_minutes: totalBreakMin,
        pause_start: firstPause ? fromDatetimeLocal(firstPause.startTime) : null,
        pause_end: firstPause ? fromDatetimeLocal(firstPause.endTime) : null,
        total_pause_minutes: totalPauseMin,
      };

      // ---- Build RPC payloads ----
      const sessionsToDelete = sessions.filter((s) => s.deleted && s.dbId).map((s) => s.dbId!);

      const sessionsToUpdate = sessions
        .filter((s) => !s.deleted && s.dbId)
        .map((s) => {
          const startIso = fromDatetimeLocal(s.startTime);
          const endIso = fromDatetimeLocal(s.endTime);
          const dur = calcMinutes(s.startTime, s.endTime);
          return {
            id: s.dbId,
            session_type: s.sessionType,
            start_time: startIso,
            end_time: endIso || null,
            duration_minutes: dur > 0 ? dur : null,
          };
        });

      const sessionsToInsert = sessions
        .filter((s) => !s.deleted && !s.dbId && s.startTime)
        .map((s) => {
          const startIso = fromDatetimeLocal(s.startTime);
          const endIso = fromDatetimeLocal(s.endTime);
          const dur = calcMinutes(s.startTime, s.endTime);
          return {
            session_type: s.sessionType,
            start_time: startIso,
            end_time: endIso || null,
            duration_minutes: dur > 0 ? dur : null,
          };
        });

      // Atomic DB transaction via RPC
      const { error: updateError } = await supabase.rpc("apply_attendance_edit", {
        _attendance_log_id: record.id,
        _clock_in: newValues.clock_in!,
        _clock_out: newValues.clock_out,
        _break_start: newValues.break_start,
        _break_end: newValues.break_end,
        _total_break_minutes: newValues.total_break_minutes,
        _pause_start: newValues.pause_start,
        _pause_end: newValues.pause_end,
        _total_pause_minutes: newValues.total_pause_minutes,
        _sessions_to_delete: sessionsToDelete,
        _sessions_to_update: sessionsToUpdate,
        _sessions_to_insert: sessionsToInsert,
      } as any);

      if (updateError) throw updateError;

      // Insert audit log
      const { error: auditError } = await supabase.from("attendance_edit_logs").insert({
        attendance_id: record.id,
        edited_by: user.id,
        old_values: oldValues as any,
        new_values: newValues as any,
        reason: reason.trim(),
      });

      if (auditError) throw auditError;

      // Send notification to CEO (VP role) about the edit
      const { data: editorProfile } = await supabase
        .from("profiles")
        .select("first_name, last_name, email")
        .eq("user_id", user.id)
        .single();

      const editorName = editorProfile ? `${editorProfile.first_name} ${editorProfile.last_name}` : "A manager";
      const editorEmail = editorProfile?.email || "";
      const editDate = new Date(record.clock_in).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });

      const changes: string[] = [];
      if (oldValues.clock_in !== newValues.clock_in)
        changes.push(`Clock In: ${formatTimeShort(oldValues.clock_in)} → ${formatTimeShort(newValues.clock_in)}`);
      if (oldValues.clock_out !== newValues.clock_out)
        changes.push(`Clock Out: ${formatTimeShort(oldValues.clock_out)} → ${formatTimeShort(newValues.clock_out)}`);
      if (oldValues.total_break_minutes !== newValues.total_break_minutes)
        changes.push(`Break: ${oldValues.total_break_minutes}m → ${newValues.total_break_minutes}m`);
      if ((oldValues.total_pause_minutes || 0) !== newValues.total_pause_minutes)
        changes.push(`Pause: ${oldValues.total_pause_minutes || 0}m → ${newValues.total_pause_minutes}m`);

      const changeSummary = changes.length > 0 ? changes.join(", ") : "Minor adjustments";

      const { data: vpUsers } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "vp" as any);

      if (vpUsers && vpUsers.length > 0) {
        for (const vp of vpUsers) {
          if (vp.user_id !== user.id) {
            await supabase.rpc("create_notification", {
              p_user_id: vp.user_id,
              p_title: "⚠️ Attendance Edited",
              p_message: `${editorName} edited attendance for ${record.employee_name} on ${editDate}. Changes: ${changeSummary}. Reason: ${reason.trim()}`,
              p_type: "warning",
              p_link: "/reports",
            });
          }
        }
      }

      try {
        await supabase.functions.invoke("send-attendance-edit-notification", {
          body: {
            editor_name: editorName,
            editor_email: editorEmail,
            employee_name: record.employee_name,
            edit_date: editDate,
            change_summary: changeSummary,
            reason: reason.trim(),
          },
        });
      } catch (emailErr) {
        console.error("Failed to send attendance edit email:", emailErr);
      }

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
          <DialogDescription>
            Modify attendance data. A reason is required and an audit log will be created.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Clock In / Out */}
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

          {/* Break Sessions */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5">
                <Coffee className="h-3.5 w-3.5 text-warning" />
                Breaks ({visibleBreaks.length})
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addSession("break")}
                className="h-7 text-xs gap-1"
              >
                <Plus className="h-3 w-3" /> Add Break
              </Button>
            </div>
            {loadingSessions ? (
              <div className="flex items-center justify-center py-3">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : visibleBreaks.length === 0 ? (
              <p className="text-xs text-muted-foreground py-1">No breaks</p>
            ) : (
              <div className="space-y-2">
                {sessions.map((s, idx) => {
                  if (s.deleted || s.sessionType !== "break") return null;
                  return (
                    <div key={idx} className="flex items-end gap-2">
                      <div className="flex-1 space-y-1">
                        <span className="text-[10px] text-muted-foreground">Start</span>
                        <Input
                          type="datetime-local"
                          value={s.startTime}
                          onChange={(e) => updateSession(idx, "startTime", e.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="flex-1 space-y-1">
                        <span className="text-[10px] text-muted-foreground">End</span>
                        <Input
                          type="datetime-local"
                          value={s.endTime}
                          onChange={(e) => updateSession(idx, "endTime", e.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap pb-1.5">
                        {calcMinutes(s.startTime, s.endTime)}m
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => removeSession(idx)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Pause Sessions */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5">
                <Pause className="h-3.5 w-3.5 text-info" />
                Pauses ({visiblePauses.length})
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addSession("pause")}
                className="h-7 text-xs gap-1"
              >
                <Plus className="h-3 w-3" /> Add Pause
              </Button>
            </div>
            {loadingSessions ? (
              <div className="flex items-center justify-center py-3">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : visiblePauses.length === 0 ? (
              <p className="text-xs text-muted-foreground py-1">No pauses</p>
            ) : (
              <div className="space-y-2">
                {sessions.map((s, idx) => {
                  if (s.deleted || s.sessionType !== "pause") return null;
                  return (
                    <div key={idx} className="flex items-end gap-2">
                      <div className="flex-1 space-y-1">
                        <span className="text-[10px] text-muted-foreground">Start</span>
                        <Input
                          type="datetime-local"
                          value={s.startTime}
                          onChange={(e) => updateSession(idx, "startTime", e.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="flex-1 space-y-1">
                        <span className="text-[10px] text-muted-foreground">End</span>
                        <Input
                          type="datetime-local"
                          value={s.endTime}
                          onChange={(e) => updateSession(idx, "endTime", e.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap pb-1.5">
                        {calcMinutes(s.startTime, s.endTime)}m
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => removeSession(idx)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Reason */}
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

        <DialogFooter className="flex justify-between sm:justify-between">
          <div>
            {!confirmDelete ? (
              <Button variant="destructive" onClick={() => setConfirmDelete(true)} disabled={saving || deleting}>
                Delete Record
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <Button variant="destructive" onClick={handleDelete} disabled={deleting || !reason.trim()}>
                  {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Confirm Delete
                </Button>
                <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)} disabled={deleting}>
                  No
                </Button>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving || deleting}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || deleting || !reason.trim()}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
