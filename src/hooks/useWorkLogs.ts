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

// ========== FIX: Helper functions for LOCAL timezone date handling ==========

/**
 * Format date as YYYY-MM-DD in LOCAL timezone (not UTC)
 * This prevents the date from shifting due to timezone offset
 */
const formatLocalDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

/**
 * Get today's date at midnight in local timezone
 * Ensures consistent date comparison
 */
const getLocalToday = (): Date => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

// =============================================================================

export function useWorkLogs() {
  const [logs, setLogs] = useState<WorkLog[]>([]);
  const [teamLogs, setTeamLogs] = useState<WorkLog[]>([]);
  const [loading, setLoading] = useState(true);
  // FIX: Initialize with local midnight to prevent timezone issues
  const [selectedDate, setSelectedDate] = useState<Date>(getLocalToday);
  const { user, isManager, isVP } = useAuth();
  const { toast } = useToast();

  const fetchMyLogs = useCallback(
    async (date: Date) => {
      if (!user) return;

      try {
        // FIX: Use formatLocalDate instead of toISOString() to prevent UTC conversion
        const dateStr = formatLocalDate(date);
        const { data, error } = await supabase
          .from("work_logs")
          .select(
            `
          *,
          client:clients(name, client_id)
        `,
          )
          .eq("user_id", user.id)
          .eq("log_date", dateStr)
          .order("created_at", { ascending: false });

        if (error) throw error;
        setLogs((data as WorkLog[]) || []);
      } catch (error: any) {
        console.error("Error fetching work logs:", error);
        toast({
          title: "Error",
          description: "Failed to fetch work logs",
          variant: "destructive",
        });
      }
    },
    [user, toast],
  );

  const fetchTeamLogs = useCallback(
    async (date: Date) => {
      if (!user || (!isManager && !isVP)) return;

      try {
        // FIX: Use formatLocalDate instead of toISOString()
        const dateStr = formatLocalDate(date);
        const { data, error } = await supabase
          .from("work_logs")
          .select(
            `
          *,
          employee:employees(first_name, last_name, department),
          client:clients(name, client_id)
        `,
          )
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

  const addLog = async (input: WorkLogInput) => {
    if (!user) return null;

    try {
      // Get employee_id, org_id, and department
      const { data: employeeData } = await supabase
        .from("employees")
        .select("id, org_id, department")
        .eq("email", user.email)
        .single();

      const { data, error } = await supabase
        .from("work_logs")
        .insert({
          user_id: user.id,
          employee_id: employeeData?.id || null,
          org_id: employeeData?.org_id || null,
          // FIX: Use formatLocalDate instead of toISOString()
          log_date: input.log_date || formatLocalDate(selectedDate),
          task_description: input.task_description,
          time_spent_minutes: input.time_spent_minutes,
          notes: input.notes || null,
          client_id: input.client_id || null,
          department: input.department || employeeData?.department || null,
          start_time: input.start_time || null,
          end_time: input.end_time || null,
          status: input.status || "completed",
        })
        .select(`*, client:clients(name, client_id)`)
        .single();

      if (error) throw error;

      toast({
        title: "Success",
        description: "Work log added successfully",
      });

      await fetchMyLogs(selectedDate);
      return data;
    } catch (error: any) {
      console.error("Error adding work log:", error);
      toast({
        title: "Error",
        description: "Failed to add work log",
        variant: "destructive",
      });
      return null;
    }
  };

  const updateLog = async (id: string, input: Partial<WorkLogInput>) => {
    if (!user) return;

    try {
      // First, get the current log data to store in history
      const { data: currentLog, error: fetchError } = await supabase
        .from("work_logs")
        .select("*")
        .eq("id", id)
        .single();

      if (fetchError) throw fetchError;

      // Insert the edit history record
      const { error: historyError } = await supabase.from("work_log_history").insert({
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

      if (historyError) {
        console.error("Error saving edit history:", historyError);
        // Continue with update even if history fails
      }

      // Now update the log
      const updateData: Record<string, any> = {};
      if (input.task_description !== undefined) updateData.task_description = input.task_description;
      if (input.time_spent_minutes !== undefined) updateData.time_spent_minutes = input.time_spent_minutes;
      if (input.notes !== undefined) updateData.notes = input.notes;
      if (input.client_id !== undefined) updateData.client_id = input.client_id;
      if (input.department !== undefined) updateData.department = input.department;
      if (input.start_time !== undefined) updateData.start_time = input.start_time;
      if (input.end_time !== undefined) updateData.end_time = input.end_time;
      if (input.status !== undefined) updateData.status = input.status;

      const { error } = await supabase.from("work_logs").update(updateData).eq("id", id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Work log updated successfully",
      });

      await fetchMyLogs(selectedDate);
    } catch (error: any) {
      console.error("Error updating work log:", error);
      toast({
        title: "Error",
        description: "Failed to update work log",
        variant: "destructive",
      });
    }
  };

  const deleteLog = async (id: string) => {
    try {
      const { error } = await supabase.from("work_logs").delete().eq("id", id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Work log deleted successfully",
      });

      await fetchMyLogs(selectedDate);
    } catch (error: any) {
      console.error("Error deleting work log:", error);
      toast({
        title: "Error",
        description: "Failed to delete work log",
        variant: "destructive",
      });
    }
  };

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
    addLog,
    updateLog,
    deleteLog,
    refetch: () => {
      fetchMyLogs(selectedDate);
      fetchTeamLogs(selectedDate);
    },
  };
}
