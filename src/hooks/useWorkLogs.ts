import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export interface WorkLog {
  id: string;
  user_id: string;
  employee_id: string | null;
  org_id: string | null;
  client_id: string | null;
  department: string | null;
  log_date: string;
  task_description: string;
  time_spent_minutes: number;
  notes: string | null;
  start_time: string | null;
  end_time: string | null;
  status: string | null;
  pause_start: string | null;
  pause_end: string | null;
  total_pause_minutes: number;
  created_at: string;
  updated_at: string;
  employee?: {
    first_name: string;
    last_name: string;
    department: string | null;
  };
  client?: {
    name: string;
    client_id: string | null;
  };
}

export interface WorkLogInput {
  task_description: string;
  time_spent_minutes: number;
  notes?: string;
  log_date?: string;
  client_id?: string;
  department?: string;
  start_time?: string;
  end_time?: string;
  status?: string;
}

// ========== Helper functions ==========

const formatLocalDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getLocalToday = (): Date => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

/** Calculate minutes between two HH:mm strings */
export const calcMinutesBetween = (start: string, end: string): number => {
  if (!start || !end) return 0;
  const [sH, sM] = start.split(":").map(Number);
  const [eH, eM] = end.split(":").map(Number);
  const s = sH * 60 + sM;
  const e = eH * 60 + eM;
  return e < s ? 24 * 60 - s + e : e - s;
};

// ── Build a full history record capturing ALL changed fields ─────────────
function buildHistoryRecord(
  workLogId: string,
  userId: string,
  currentLog: any,
  updates: {
    task_description?: string;
    time_spent_minutes?: number;
    notes?: string | null;
    log_date?: string;
    start_time?: string | null;
    end_time?: string | null;
    status?: string | null;
    client_id?: string | null;
    department?: string | null;
    total_pause_minutes?: number;
  },
): Record<string, any> | null {
  const newDesc = updates.task_description !== undefined ? updates.task_description : currentLog.task_description;
  const newNotes = updates.notes !== undefined ? (updates.notes ?? null) : currentLog.notes;
  const newTimeMinutes =
    updates.time_spent_minutes !== undefined ? updates.time_spent_minutes : currentLog.time_spent_minutes;
  const newLogDate = updates.log_date || currentLog.log_date;
  const newStartTime = updates.start_time !== undefined ? (updates.start_time ?? null) : currentLog.start_time;
  const newEndTime = updates.end_time !== undefined ? (updates.end_time ?? null) : currentLog.end_time;
  const newStatus = updates.status !== undefined ? (updates.status ?? null) : currentLog.status;
  const newClientId = updates.client_id !== undefined ? updates.client_id || null : currentLog.client_id;
  const newDepartment = updates.department !== undefined ? (updates.department ?? null) : currentLog.department;
  const newTotalPause =
    updates.total_pause_minutes !== undefined ? updates.total_pause_minutes : currentLog.total_pause_minutes;

  // Check if anything actually changed
  const hasRealChange =
    newDesc !== currentLog.task_description ||
    newTimeMinutes !== currentLog.time_spent_minutes ||
    newNotes !== currentLog.notes ||
    newLogDate !== currentLog.log_date ||
    newStartTime !== currentLog.start_time ||
    newEndTime !== currentLog.end_time ||
    newStatus !== currentLog.status ||
    newClientId !== currentLog.client_id ||
    newDepartment !== currentLog.department ||
    newTotalPause !== currentLog.total_pause_minutes;

  if (!hasRealChange) return null;

  return {
    work_log_id: workLogId,
    user_id: userId,
    change_type: "update",
    // Original fields
    previous_task_description: currentLog.task_description,
    new_task_description: newDesc,
    previous_time_spent_minutes: currentLog.time_spent_minutes,
    new_time_spent_minutes: newTimeMinutes,
    previous_notes: currentLog.notes,
    new_notes: newNotes,
    previous_log_date: currentLog.log_date,
    new_log_date: newLogDate,
    // New tracked fields
    previous_start_time: currentLog.start_time,
    new_start_time: newStartTime,
    previous_end_time: currentLog.end_time,
    new_end_time: newEndTime,
    previous_status: currentLog.status,
    new_status: newStatus,
    previous_client_id: currentLog.client_id,
    new_client_id: newClientId,
    previous_department: currentLog.department,
    new_department: newDepartment,
    previous_total_pause_minutes: currentLog.total_pause_minutes || 0,
    new_total_pause_minutes: newTotalPause ?? currentLog.total_pause_minutes ?? 0,
  };
}

// =============================================================================

export function useWorkLogs() {
  const [logs, setLogs] = useState<WorkLog[]>([]);
  const [teamLogs, setTeamLogs] = useState<WorkLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(getLocalToday);
  const [userDepartment, setUserDepartment] = useState<string | null>(null);
  const [employeeInfo, setEmployeeInfo] = useState<{
    id: string;
    org_id: string;
    department: string | null;
  } | null>(null);
  const { user, isManager, isVP, isLineManager } = useAuth();
  const { toast } = useToast();

  // ── Fetch employee info once on mount ─────────────────────────────────
  const fetchEmployeeInfo = useCallback(async () => {
    if (!user?.email) return;
    try {
      const { data, error } = await supabase
        .from("employees")
        .select("id, org_id, department")
        .eq("email", user.email)
        .single();
      if (error) {
        console.error("Error fetching employee info:", error);
        return;
      }
      if (data) {
        setEmployeeInfo({ id: data.id, org_id: data.org_id, department: data.department });
        setUserDepartment(data.department || null);
      }
    } catch (err) {
      console.error("Error fetching employee info:", err);
    }
  }, [user?.email]);

  useEffect(() => {
    fetchEmployeeInfo();
  }, [fetchEmployeeInfo]);

  // ── Fetch my logs ─────────────────────────────────────────────────────
  const fetchMyLogs = useCallback(
    async (date: Date) => {
      if (!user) return;
      try {
        const dateStr = formatLocalDate(date);
        const { data, error } = await supabase
          .from("work_logs")
          .select(`*, client:clients(name, client_id)`)
          .eq("user_id", user.id)
          .eq("log_date", dateStr)
          .order("created_at", { ascending: false });
        if (error) throw error;
        setLogs((data as WorkLog[]) || []);
      } catch (error: any) {
        console.error("Error fetching work logs:", error);
        toast({ title: "Error", description: "Failed to fetch work logs", variant: "destructive" });
      }
    },
    [user, toast],
  );

  // ── Fetch team logs (scoped to team members only) ──────────────────────
  const fetchTeamLogs = useCallback(
    async (date: Date) => {
      if (!user || (!isManager && !isVP && !isLineManager)) return;
      try {
        const dateStr = formatLocalDate(date);

        if (isVP) {
          const { data, error } = await supabase
            .from("work_logs")
            .select(`*, employee:employees(first_name, last_name, department), client:clients(name, client_id)`)
            .eq("log_date", dateStr)
            .neq("user_id", user.id)
            .order("created_at", { ascending: false });
          if (error) throw error;
          setTeamLogs((data as WorkLog[]) || []);
        } else {
          const { data: myEmpId } = await supabase.rpc("get_employee_id_for_user", {
            _user_id: user.id,
          });

          if (!myEmpId) {
            setTeamLogs([]);
            return;
          }

          const { data: teamEmployees } = await supabase
            .from("employees")
            .select("id, profile_id")
            .or(`line_manager_id.eq.${myEmpId},manager_id.eq.${myEmpId}`);

          if (!teamEmployees || teamEmployees.length === 0) {
            setTeamLogs([]);
            return;
          }

          // Resolve user IDs from profile_id, and also directly from profiles by email for employees with NULL profile_id
          const profileIds = teamEmployees.map((e) => e.profile_id).filter(Boolean);
          const empIdsWithoutProfile = teamEmployees.filter((e) => !e.profile_id).map((e) => e.id);

          let teamUserIds: string[] = [];

          if (profileIds.length > 0) {
            const { data: profiles } = await supabase.from("profiles").select("user_id").in("id", profileIds);
            teamUserIds = (profiles || []).map((p) => p.user_id);
          }

          // For employees without profile_id, look up by email match in profiles
          if (empIdsWithoutProfile.length > 0) {
            const { data: empsWithoutProfile } = await supabase
              .from("employees")
              .select("email")
              .in("id", empIdsWithoutProfile);
            if (empsWithoutProfile && empsWithoutProfile.length > 0) {
              const emails = empsWithoutProfile.map((e) => e.email);
              const { data: matchedProfiles } = await supabase
                .from("profiles")
                .select("user_id")
                .in("email", emails);
              if (matchedProfiles) {
                teamUserIds = [...teamUserIds, ...matchedProfiles.map((p) => p.user_id)];
              }
            }
          }

          if (teamUserIds.length === 0) {
            setTeamLogs([]);
            return;
          }

          const { data, error } = await supabase
            .from("work_logs")
            .select(`*, employee:employees(first_name, last_name, department), client:clients(name, client_id)`)
            .eq("log_date", dateStr)
            .in("user_id", teamUserIds)
            .order("created_at", { ascending: false });
          if (error) throw error;
          setTeamLogs((data as WorkLog[]) || []);
        }
      } catch (error: any) {
        console.error("Error fetching team logs:", error);
      }
    },
    [user, isManager, isVP, isLineManager],
  );

  // ── Add log (auto-pause existing in-progress logs) ─────────────────────
  const addLog = async (input: WorkLogInput) => {
    if (!user) return null;
    try {
      // Auto-pause any currently in-progress logs when starting a new one
      if (!input.end_time) {
        const { data: activeLogs } = await supabase
          .from("work_logs")
          .select("id, pause_start, total_pause_minutes")
          .eq("user_id", user.id)
          .eq("status", "in_progress")
          .is("end_time", null);

        if (activeLogs && activeLogs.length > 0) {
          for (const activeLog of activeLogs) {
            await supabase
              .from("work_logs")
              .update({
                status: "on_hold",
                pause_start: new Date().toISOString(),
              })
              .eq("id", activeLog.id);
          }
        }
      }

      const { data, error } = await supabase
        .from("work_logs")
        .insert({
          user_id: user.id,
          employee_id: employeeInfo?.id || null,
          org_id: employeeInfo?.org_id || null,
          log_date: input.log_date || formatLocalDate(selectedDate),
          task_description: input.task_description,
          time_spent_minutes: input.time_spent_minutes,
          notes: input.notes || null,
          client_id: input.client_id || null,
          department: input.department || employeeInfo?.department || null,
          start_time: input.start_time || null,
          end_time: input.end_time || null,
          status: !input.end_time ? "in_progress" : input.status || "completed",
        })
        .select(`*, client:clients(name, client_id)`)
        .single();
      if (error) throw error;
      toast({
        title: "Success",
        description: input.end_time ? "Work log added" : "Work log started — add end time when done",
      });
      await fetchMyLogs(selectedDate);
      return data;
    } catch (error: any) {
      console.error("Error adding work log:", error);
      toast({ title: "Error", description: "Failed to add work log", variant: "destructive" });
      return null;
    }
  };

  // ── Full update (dialog-based) ────────────────────────────────────────
  const updateLog = async (id: string, input: Partial<WorkLogInput>) => {
    if (!user) return;
    try {
      const { data: currentLog, error: fetchError } = await supabase
        .from("work_logs")
        .select("*")
        .eq("id", id)
        .single();
      if (fetchError) throw fetchError;

      // Block updates on completed tasks
      if (currentLog.status === "completed") {
        toast({ title: "Locked", description: "Completed tasks cannot be modified", variant: "destructive" });
        return;
      }

      const updateData: Record<string, any> = {};
      if (input.task_description !== undefined) updateData.task_description = input.task_description;
      if (input.time_spent_minutes !== undefined) updateData.time_spent_minutes = input.time_spent_minutes;
      if (input.notes !== undefined) updateData.notes = input.notes || null;
      if (input.client_id !== undefined) updateData.client_id = input.client_id || null;
      if (input.department !== undefined) updateData.department = input.department;
      if (input.start_time !== undefined) updateData.start_time = input.start_time;
      if (input.end_time !== undefined) updateData.end_time = input.end_time || null;
      if (input.status !== undefined) updateData.status = input.status;

      // Auto-set end time when marking as completed
      if (input.status === "completed" && !input.end_time && !currentLog.end_time) {
        const now = new Date();
        updateData.end_time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      }

      // Auto-recalculate time (subtract pause minutes)
      const finalStart = input.start_time ?? currentLog.start_time;
      const finalEnd = updateData.end_time ?? input.end_time ?? currentLog.end_time;
      if (finalStart && finalEnd) {
        const rawMinutes = calcMinutesBetween(finalStart, finalEnd);
        const pauseMinutes = currentLog.total_pause_minutes || 0;
        updateData.time_spent_minutes = Math.max(0, rawMinutes - pauseMinutes);
      }

      // Build comprehensive history record BEFORE applying update
      const historyRecord = buildHistoryRecord(id, user.id, currentLog, {
        ...updateData,
        log_date: input.log_date || currentLog.log_date,
      });

      if (historyRecord) {
        await supabase.from("work_log_history").insert(historyRecord as any);
      }

      const { error } = await supabase.from("work_logs").update(updateData).eq("id", id);
      if (error) throw error;
      toast({ title: "Success", description: "Work log updated" });
      await fetchMyLogs(selectedDate);
    } catch (error: any) {
      console.error("Error updating work log:", error);
      toast({ title: "Error", description: "Failed to update work log", variant: "destructive" });
    }
  };

  // ── Quick inline update (with history) ────────────────────────────────
  const quickUpdate = async (id: string, fields: Partial<WorkLogInput>) => {
    if (!user) return;
    try {
      const { data: currentLog } = await supabase.from("work_logs").select("*").eq("id", id).single();

      // Block updates on completed tasks
      if (currentLog?.status === "completed") {
        toast({ title: "Locked", description: "Completed tasks cannot be modified", variant: "destructive" });
        return;
      }

      const updateData: Record<string, any> = {};
      if (fields.end_time !== undefined) updateData.end_time = fields.end_time || null;
      if (fields.status !== undefined) updateData.status = fields.status;
      if (fields.start_time !== undefined) updateData.start_time = fields.start_time;
      if (fields.task_description !== undefined) updateData.task_description = fields.task_description;
      if (fields.notes !== undefined) updateData.notes = fields.notes || null;
      if (fields.client_id !== undefined) updateData.client_id = fields.client_id || null;
      if (fields.department !== undefined) updateData.department = fields.department;

      // Auto-set end time when marking as completed
      if (fields.status === "completed" && !fields.end_time && !currentLog?.end_time) {
        const now = new Date();
        updateData.end_time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      }

      // Auto-recalculate time (subtract pause minutes)
      const finalStart = fields.start_time ?? currentLog?.start_time;
      const finalEnd = updateData.end_time ?? fields.end_time ?? currentLog?.end_time;
      if (finalStart && finalEnd) {
        const rawMinutes = calcMinutesBetween(finalStart, finalEnd);
        const pauseMinutes = currentLog?.total_pause_minutes || 0;
        updateData.time_spent_minutes = Math.max(0, rawMinutes - pauseMinutes);
      }

      // Build comprehensive history record BEFORE applying update
      if (currentLog) {
        const historyRecord = buildHistoryRecord(id, user.id, currentLog, updateData);
        if (historyRecord) {
          await supabase.from("work_log_history").insert(historyRecord as any);
        }
      }

      const { error } = await supabase.from("work_logs").update(updateData).eq("id", id);
      if (error) throw error;
      toast({ title: "Updated", description: "Work log updated" });
      await fetchMyLogs(selectedDate);
    } catch (error: any) {
      console.error("Error with quick update:", error);
      toast({ title: "Error", description: "Failed to update", variant: "destructive" });
    }
  };

  // ── Pause / Resume a log ──────────────────────────────────────────────
  const pauseLog = async (id: string) => {
    if (!user) return;
    try {
      // Fetch current log to record history
      const { data: currentLog } = await supabase.from("work_logs").select("*").eq("id", id).single();

      const newStatus = "on_hold";
      const newPauseStart = new Date().toISOString();

      // Record history for pause action
      if (currentLog) {
        const historyRecord = buildHistoryRecord(id, user.id, currentLog, {
          status: newStatus,
        });
        if (historyRecord) {
          await supabase.from("work_log_history").insert(historyRecord as any);
        }
      }

      const { error } = await supabase
        .from("work_logs")
        .update({
          status: newStatus,
          pause_start: newPauseStart,
        })
        .eq("id", id);
      if (error) throw error;
      toast({ title: "Paused", description: "Work log paused" });
      await fetchMyLogs(selectedDate);
    } catch (error: any) {
      console.error("Error pausing log:", error);
      toast({ title: "Error", description: "Failed to pause", variant: "destructive" });
    }
  };

  const resumeLog = async (id: string) => {
    if (!user) return;
    try {
      const { data: currentLog } = await supabase.from("work_logs").select("*").eq("id", id).single();
      if (!currentLog) return;

      let additionalPauseMinutes = 0;
      if (currentLog.pause_start) {
        const pauseStart = new Date(currentLog.pause_start);
        const now = new Date();
        additionalPauseMinutes = Math.round((now.getTime() - pauseStart.getTime()) / 60000);
      }

      const newTotalPause = (currentLog.total_pause_minutes || 0) + additionalPauseMinutes;

      // Record history for resume action
      const historyRecord = buildHistoryRecord(id, user.id, currentLog, {
        status: "in_progress",
        total_pause_minutes: newTotalPause,
      });
      if (historyRecord) {
        await supabase.from("work_log_history").insert(historyRecord as any);
      }

      const { error } = await supabase
        .from("work_logs")
        .update({
          status: "in_progress",
          pause_end: new Date().toISOString(),
          total_pause_minutes: newTotalPause,
        })
        .eq("id", id);
      if (error) throw error;
      toast({ title: "Resumed", description: `Paused for ${additionalPauseMinutes}m` });
      await fetchMyLogs(selectedDate);
    } catch (error: any) {
      console.error("Error resuming log:", error);
      toast({ title: "Error", description: "Failed to resume", variant: "destructive" });
    }
  };

  // ── Delete log ────────────────────────────────────────────────────────
  const deleteLog = async (id: string) => {
    try {
      const { error } = await supabase.from("work_logs").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Success", description: "Work log deleted" });
      await fetchMyLogs(selectedDate);
    } catch (error: any) {
      console.error("Error deleting work log:", error);
      toast({ title: "Error", description: "Failed to delete work log", variant: "destructive" });
    }
  };

  // ── Load on date change ───────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    Promise.all([fetchMyLogs(selectedDate), fetchTeamLogs(selectedDate)]).finally(() => setLoading(false));
  }, [selectedDate, fetchMyLogs, fetchTeamLogs]);

  return {
    logs,
    teamLogs,
    loading,
    selectedDate,
    setSelectedDate,
    userDepartment,
    addLog,
    updateLog,
    quickUpdate,
    deleteLog,
    pauseLog,
    resumeLog,
    refetch: () => {
      fetchMyLogs(selectedDate);
      fetchTeamLogs(selectedDate);
    },
  };
}
