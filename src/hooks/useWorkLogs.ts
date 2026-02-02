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
  const { user, isManager, isVP } = useAuth();
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

  // ── Fetch team logs ───────────────────────────────────────────────────
  const fetchTeamLogs = useCallback(
    async (date: Date) => {
      if (!user || (!isManager && !isVP)) return;
      try {
        const dateStr = formatLocalDate(date);
        const { data, error } = await supabase
          .from("work_logs")
          .select(`*, employee:employees(first_name, last_name, department), client:clients(name, client_id)`)
          .eq("log_date", dateStr)
          .neq("user_id", user.id)
          .order("created_at", { ascending: false });
        if (error) throw error;
        setTeamLogs((data as WorkLog[]) || []);
      } catch (error: any) {
        console.error("Error fetching team logs:", error);
      }
    },
    [user, isManager, isVP],
  );

  // ── Add log ───────────────────────────────────────────────────────────
  const addLog = async (input: WorkLogInput) => {
    if (!user) return null;
    try {
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

      // Save history
      await supabase.from("work_log_history").insert({
        work_log_id: id,
        user_id: user.id,
        change_type: "update",
        previous_task_description: currentLog.task_description,
        new_task_description: input.task_description || currentLog.task_description,
        previous_time_spent_minutes: currentLog.time_spent_minutes,
        new_time_spent_minutes: input.time_spent_minutes ?? currentLog.time_spent_minutes,
        previous_notes: currentLog.notes,
        new_notes: input.notes ?? currentLog.notes,
        previous_log_date: currentLog.log_date,
        new_log_date: input.log_date || currentLog.log_date,
      });

      const updateData: Record<string, any> = {};
      if (input.task_description !== undefined) updateData.task_description = input.task_description;
      if (input.time_spent_minutes !== undefined) updateData.time_spent_minutes = input.time_spent_minutes;
      if (input.notes !== undefined) updateData.notes = input.notes || null;
      if (input.client_id !== undefined) updateData.client_id = input.client_id || null;
      if (input.department !== undefined) updateData.department = input.department;
      if (input.start_time !== undefined) updateData.start_time = input.start_time;
      if (input.end_time !== undefined) updateData.end_time = input.end_time || null;
      if (input.status !== undefined) updateData.status = input.status;

      // Auto-recalculate time
      const finalStart = input.start_time ?? currentLog.start_time;
      const finalEnd = input.end_time ?? currentLog.end_time;
      if (finalStart && finalEnd) {
        updateData.time_spent_minutes = calcMinutesBetween(finalStart, finalEnd);
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

      if (currentLog) {
        // Save edit history
        await supabase.from("work_log_history").insert({
          work_log_id: id,
          user_id: user.id,
          change_type: "update",
          previous_task_description: currentLog.task_description,
          new_task_description: fields.task_description || currentLog.task_description,
          previous_time_spent_minutes: currentLog.time_spent_minutes,
          new_time_spent_minutes: fields.time_spent_minutes ?? currentLog.time_spent_minutes,
          previous_notes: currentLog.notes,
          new_notes: fields.notes ?? currentLog.notes,
          previous_log_date: currentLog.log_date,
          new_log_date: fields.log_date || currentLog.log_date,
        });
      }

      const updateData: Record<string, any> = {};
      if (fields.end_time !== undefined) updateData.end_time = fields.end_time || null;
      if (fields.status !== undefined) updateData.status = fields.status;
      if (fields.start_time !== undefined) updateData.start_time = fields.start_time;
      if (fields.task_description !== undefined) updateData.task_description = fields.task_description;
      if (fields.notes !== undefined) updateData.notes = fields.notes || null;
      if (fields.client_id !== undefined) updateData.client_id = fields.client_id || null;
      if (fields.department !== undefined) updateData.department = fields.department;

      // Auto-recalculate time
      const finalStart = fields.start_time ?? currentLog?.start_time;
      const finalEnd = fields.end_time ?? currentLog?.end_time;
      if (finalStart && finalEnd) {
        updateData.time_spent_minutes = calcMinutesBetween(finalStart, finalEnd);
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
    refetch: () => {
      fetchMyLogs(selectedDate);
      fetchTeamLogs(selectedDate);
    },
  };
}
