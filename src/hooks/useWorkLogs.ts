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

        // For VP/Admin, show all logs; for managers/line managers, scope to their team
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
          // Get my employee ID to find team members
          const { data: myEmpId } = await supabase.rpc("get_employee_id_for_user", {
            _user_id: user.id,
          });

          if (!myEmpId) {
            setTeamLogs([]);
            return;
          }

          // Get team member employee IDs (both line_manager_id and manager_id)
          const { data: teamEmployees } = await supabase
            .from("employees")
            .select("id, profile_id")
            .or(`line_manager_id.eq.${myEmpId},manager_id.eq.${myEmpId}`);

          if (!teamEmployees || teamEmployees.length === 0) {
            setTeamLogs([]);
            return;
          }

          // Get user IDs for these employees via profiles
          const profileIds = teamEmployees.map((e) => e.profile_id).filter(Boolean);
          if (profileIds.length === 0) {
            setTeamLogs([]);
            return;
          }

          const { data: profiles } = await supabase
            .from("profiles")
            .select("user_id")
            .in("id", profileIds);

          const teamUserIds = (profiles || []).map((p) => p.user_id);
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

      // Save history only if something actually changed
      const newDesc = input.task_description !== undefined ? input.task_description : currentLog.task_description;
      const newNotes = input.notes !== undefined ? (input.notes ?? null) : currentLog.notes;
      const newTimeMinutes = input.time_spent_minutes ?? currentLog.time_spent_minutes;

      const hasRealChange =
        newDesc !== currentLog.task_description ||
        newTimeMinutes !== currentLog.time_spent_minutes ||
        newNotes !== currentLog.notes;

      if (hasRealChange) {
        await supabase.from("work_log_history").insert({
          work_log_id: id,
          user_id: user.id,
          change_type: "update",
          previous_task_description: currentLog.task_description,
          new_task_description: newDesc,
          previous_time_spent_minutes: currentLog.time_spent_minutes,
          new_time_spent_minutes: newTimeMinutes,
          previous_notes: currentLog.notes,
          new_notes: newNotes,
          previous_log_date: currentLog.log_date,
          new_log_date: input.log_date || currentLog.log_date,
        });
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

      if (currentLog) {
        // Only save edit history if something actually changed
        const newDesc = fields.task_description !== undefined ? fields.task_description : currentLog.task_description;
        const newNotes = fields.notes !== undefined ? (fields.notes ?? null) : currentLog.notes;
        const newEndTime = fields.end_time !== undefined ? (fields.end_time || null) : currentLog.end_time;
        const newStartTime = fields.start_time !== undefined ? fields.start_time : currentLog.start_time;
        const newStatus = fields.status !== undefined ? fields.status : currentLog.status;

        // Calculate the new time if times changed
        let newTimeMinutes = currentLog.time_spent_minutes;
        if (newStartTime && newEndTime) {
          const rawMinutes = calcMinutesBetween(newStartTime, newEndTime);
          newTimeMinutes = Math.max(0, rawMinutes - (currentLog.total_pause_minutes || 0));
        }

        const hasRealChange =
          newDesc !== currentLog.task_description ||
          newTimeMinutes !== currentLog.time_spent_minutes ||
          newNotes !== currentLog.notes ||
          newEndTime !== currentLog.end_time ||
          newStartTime !== currentLog.start_time ||
          newStatus !== currentLog.status;

        if (hasRealChange) {
          await supabase.from("work_log_history").insert({
            work_log_id: id,
            user_id: user.id,
            change_type: "update",
            previous_task_description: currentLog.task_description,
            new_task_description: newDesc,
            previous_time_spent_minutes: currentLog.time_spent_minutes,
            new_time_spent_minutes: newTimeMinutes,
            previous_notes: currentLog.notes,
            new_notes: newNotes,
            previous_log_date: currentLog.log_date,
            new_log_date: fields.log_date || currentLog.log_date,
          });
        }
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
      const { error } = await supabase
        .from("work_logs")
        .update({
          status: "on_hold",
          pause_start: new Date().toISOString(),
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

      const { error } = await supabase
        .from("work_logs")
        .update({
          status: "in_progress",
          pause_end: new Date().toISOString(),
          total_pause_minutes: (currentLog.total_pause_minutes || 0) + additionalPauseMinutes,
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
