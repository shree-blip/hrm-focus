import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

interface Task {
  id: string;
  title: string;
  description: string | null;
  client_name: string | null;
  assignee_id: string | null;
  created_by: string;
  priority: "low" | "medium" | "high";
  status: "todo" | "in-progress" | "review" | "done";
  due_date: string | null;
  time_estimate: string | null;
  is_recurring: boolean;
  created_at: string;
}

export function useTasks() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTasks = useCallback(async () => {
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setTasks(data as Task[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const createTask = async (task: {
    title: string;
    description?: string;
    client_name?: string;
    assignee_id?: string;
    priority: "low" | "medium" | "high";
    status: "todo" | "in-progress" | "review" | "done";
    due_date?: Date;
    time_estimate?: string;
    is_recurring?: boolean;
  }) => {
    if (!user) return;

    const { data, error } = await supabase
      .from("tasks")
      .insert({
        title: task.title,
        description: task.description,
        client_name: task.client_name,
        assignee_id: task.assignee_id,
        created_by: user.id,
        priority: task.priority,
        status: task.status,
        due_date: task.due_date?.toISOString().split("T")[0],
        time_estimate: task.time_estimate,
        is_recurring: task.is_recurring || false,
      })
      .select()
      .single();

    if (error) {
      toast({ title: "Error", description: "Failed to create task", variant: "destructive" });
      return null;
    } else {
      toast({ title: "Task Created", description: "Your task has been added." });
      fetchTasks();
      return data as Task;
    }
  };

  const updateTask = async (taskId: string, updates: Partial<Task>) => {
    const { error } = await supabase
      .from("tasks")
      .update(updates)
      .eq("id", taskId);

    if (error) {
      toast({ title: "Error", description: "Failed to update task", variant: "destructive" });
    } else {
      toast({ title: "Task Updated", description: "Changes saved successfully." });
      fetchTasks();
    }
  };

  const updateTaskStatus = async (taskId: string, newStatus: Task["status"]) => {
    const { error } = await supabase
      .from("tasks")
      .update({ status: newStatus })
      .eq("id", taskId);

    if (error) {
      toast({ title: "Error", description: "Failed to move task", variant: "destructive" });
    } else {
      fetchTasks();
    }
  };

  const deleteTask = async (taskId: string) => {
    const { error } = await supabase
      .from("tasks")
      .delete()
      .eq("id", taskId);

    if (error) {
      toast({ title: "Error", description: "Failed to delete task", variant: "destructive" });
    } else {
      toast({ title: "Task Deleted", description: "Task has been removed." });
      fetchTasks();
    }
  };

  return {
    tasks,
    loading,
    createTask,
    updateTask,
    updateTaskStatus,
    deleteTask,
    refetch: fetchTasks,
  };
}
