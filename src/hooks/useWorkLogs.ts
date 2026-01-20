import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export interface WorkLog {
  id: string;
  user_id: string;
  employee_id: string | null;
  org_id: string | null;
  log_date: string;
  task_description: string;
  time_spent_minutes: number;
  notes: string | null;
  client_id: string | null;
  department: string | null;
  created_at: string;
  updated_at: string;
  employee?: {
    first_name: string;
    last_name: string;
    department: string | null;
  };
  client?: {
    name: string;
  };
}

export interface WorkLogInput {
  task_description: string;
  time_spent_minutes: number;
  notes?: string;
  log_date?: string;
  client_id?: string;
  department?: string;
}

export function useWorkLogs() {
  const [logs, setLogs] = useState<WorkLog[]>([]);
  const [teamLogs, setTeamLogs] = useState<WorkLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const { user, isManager, isVP } = useAuth();
  const { toast } = useToast();

  const fetchMyLogs = useCallback(async (date: Date) => {
    if (!user) return;

    try {
      const dateStr = date.toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("work_logs")
        .select(`
          *,
          client:clients(name)
        `)
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
  }, [user, toast]);

  const fetchTeamLogs = useCallback(async (date: Date) => {
    if (!user || (!isManager && !isVP)) return;

    try {
      const dateStr = date.toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("work_logs")
        .select(`
          *,
          employee:employees(first_name, last_name, department),
          client:clients(name)
        `)
        .eq("log_date", dateStr)
        .neq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTeamLogs((data as WorkLog[]) || []);
    } catch (error: any) {
      console.error("Error fetching team logs:", error);
    }
  }, [user, isManager, isVP]);

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
          log_date: input.log_date || selectedDate.toISOString().split("T")[0],
          task_description: input.task_description,
          time_spent_minutes: input.time_spent_minutes,
          notes: input.notes || null,
          client_id: input.client_id || null,
          department: input.department || employeeData?.department || null,
        })
        .select(`
          *,
          client:clients(name)
        `)
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
      const { error: historyError } = await supabase
        .from("work_log_history")
        .insert({
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
      const { error } = await supabase
        .from("work_logs")
        .update({
          task_description: input.task_description,
          time_spent_minutes: input.time_spent_minutes,
          notes: input.notes,
        })
        .eq("id", id);

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
      const { error } = await supabase
        .from("work_logs")
        .delete()
        .eq("id", id);

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
    Promise.all([
      fetchMyLogs(selectedDate),
      fetchTeamLogs(selectedDate),
    ]).finally(() => setLoading(false));
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
