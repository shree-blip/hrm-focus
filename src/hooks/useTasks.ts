import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

interface TaskAssignee {
  user_id: string;
  assigned_by: string;
  assigned_at: string;
  assignee_name?: string;
  assigner_name?: string;
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  client_name: string | null;
  assignee_id: string | null;
  created_by: string;
  created_by_name?: string;
  priority: "low" | "medium" | "high";
  status: "todo" | "in-progress" | "review" | "done";
  due_date: string | null;
  time_estimate: string | null;
  is_recurring: boolean;
  created_at: string;
  assignees?: TaskAssignee[];
}

export function useTasks() {
  const { user } = useAuth();
  const userId = user?.id;
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTasks = useCallback(async () => {
    if (!userId) return;

    try {
      // Fetch tasks
      const { data: tasksData, error: tasksError } = await supabase
        .from("tasks")
        .select("*")
        .order("created_at", { ascending: false });

      if (tasksError) {
        console.error("Error fetching tasks:", tasksError);
        setLoading(false);
        return;
      }

      // Fetch task assignees
      const { data: assigneesData, error: assigneesError } = await supabase
        .from("task_assignees")
        .select("*");
      
      if (assigneesError) {
        console.error("Error fetching assignees:", assigneesError);
      }

      // Fetch profiles for names
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name");

      const profileMap = new Map(
        (profilesData || []).map((p) => [p.user_id, `${p.first_name} ${p.last_name}`]),
      );

      // Map assignees to tasks with names
      const assigneesByTask = new Map<string, TaskAssignee[]>();
      (assigneesData || []).forEach((a) => {
        const taskAssignees = assigneesByTask.get(a.task_id) || [];
        taskAssignees.push({
          user_id: a.user_id,
          assigned_by: a.assigned_by,
          assigned_at: a.assigned_at,
          assignee_name: profileMap.get(a.user_id) || "Unknown",
          assigner_name: profileMap.get(a.assigned_by) || "Unknown",
        });
        assigneesByTask.set(a.task_id, taskAssignees);
      });

      const tasksWithAssignees = (tasksData || []).map((task) => ({
        ...task,
        created_by_name: profileMap.get(task.created_by) || "Unknown",
        assignees: assigneesByTask.get(task.id) || [],
      })) as Task[];

      setTasks(tasksWithAssignees);
    } catch (error) {
      console.error("Unexpected error in fetchTasks:", error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchTasks();

    // Set up real-time subscription
    const channel = supabase
      .channel("tasks-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => fetchTasks())
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "task_assignees" },
        () => fetchTasks(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchTasks]);

  const createTask = async (task: {
    title: string;
    description?: string;
    client_name?: string;
    assignee_ids?: string[];
    priority: "low" | "medium" | "high";
    status: "todo" | "in-progress" | "review" | "done";
    due_date?: Date | string; // Allow string to prevent crashes from form inputs
    time_estimate?: string;
    is_recurring?: boolean;
  }) => {
    if (!userId) return null;

    try {
      // Get org_id for the user
      // Wrapped in try/catch specifically for RPC call safety
      let orgId = null;
      try {
        const { data: orgData, error: orgError } = await supabase.rpc("get_user_org_id", { _user_id: userId });
        if (!orgError) orgId = orgData;
        else console.warn("Error fetching org ID:", orgError);
      } catch (err) {
        console.warn("RPC call failed:", err);
      }

      // Safe Date Handling: Ensure we don't crash if a string is passed
      let formattedDate = null;
      if (task.due_date) {
        try {
          formattedDate = new Date(task.due_date).toISOString().split("T")[0];
        } catch (e) {
          console.error("Date formatting error:", e);
        }
      }

      const { data, error } = await supabase
        .from("tasks")
        .insert({
          title: task.title,
          description: task.description,
          client_name: task.client_name,
          created_by: userId,
          priority: task.priority,
          status: task.status,
          due_date: formattedDate,
          time_estimate: task.time_estimate,
          is_recurring: task.is_recurring || false,
          org_id: orgId,
        })
        .select()
        .single();

      if (error) {
        console.error("Task creation error:", error);
        toast({
          title: "Error",
          description: "Failed to create task: " + error.message,
          variant: "destructive",
        });
        return null;
      }

      // Add assignees if provided
      let currentAssignees: any[] = [];
      if (task.assignee_ids && task.assignee_ids.length > 0) {
        const assigneeInserts = task.assignee_ids.map((assigneeUserId) => ({
          task_id: data.id,
          user_id: assigneeUserId,
          assigned_by: userId,
        }));

        const { error: assigneeError } = await supabase.from("task_assignees").insert(assigneeInserts);
        
        if (assigneeError) {
          console.error("Assignee insertion error:", assigneeError);
          toast({
            title: "Warning",
            description: "Task created, but failed to add some assignees.",
            variant: "destructive",
          });
        } else {
            // Mock the structure needed for the return value
            currentAssignees = assigneeInserts.map(ai => ({
                ...ai,
                assigned_at: new Date().toISOString()
            }));
        }
      }

      toast({ title: "Task Created", description: "Your task has been added." });
      
      // We explicitly call fetchTasks to sync state, but we also return the formatted object
      // so the UI doesn't crash if it tries to use the return value immediately
      fetchTasks();
      
      return {
        ...data,
        assignees: currentAssignees
      } as Task;

    } catch (error: any) {
      console.error("Unexpected error in createTask:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred: " + (error.message || "Unknown error"),
        variant: "destructive",
      });
      return null;
    }
  };

  const updateTask = async (taskId: string, updates: Partial<Task>) => {
    try {
        const { error } = await supabase
        .from("tasks")
        .update({
            title: updates.title,
            description: updates.description,
            client_name: updates.client_name,
            priority: updates.priority,
            status: updates.status,
            due_date: updates.due_date,
            time_estimate: updates.time_estimate,
        })
        .eq("id", taskId);

        if (error) {
        toast({ title: "Error", description: "Failed to update task", variant: "destructive" });
        } else {
        toast({ title: "Task Updated", description: "Changes saved successfully." });
        fetchTasks();
        }
    } catch (error) {
        console.error("Update task error", error);
    }
  };

  const updateTaskAssignees = async (taskId: string, assigneeIds: string[]) => {
    if (!userId) return;

    try {
        // Delete existing assignees
        await supabase.from("task_assignees").delete().eq("task_id", taskId);

        // Add new assignees
        if (assigneeIds.length > 0) {
        const assigneeInserts = assigneeIds.map((assigneeUserId) => ({
            task_id: taskId,
            user_id: assigneeUserId,
            assigned_by: userId,
        }));

        await supabase.from("task_assignees").insert(assigneeInserts);
        }

        toast({ title: "Assignees Updated", description: "Task assignees have been updated." });
        fetchTasks();
    } catch (error) {
        console.error("Error updating assignees:", error);
        toast({ title: "Error", description: "Failed to update assignees", variant: "destructive" });
    }
  };

  const updateTaskStatus = async (taskId: string, newStatus: Task["status"]) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
    
    const { error } = await supabase
      .from("tasks")
      .update({ status: newStatus })
      .eq("id", taskId);

    if (error) {
      toast({ title: "Error", description: "Failed to move task", variant: "destructive" });
      fetchTasks();
    }
  };

  const deleteTask = async (taskId: string) => {
    const previousTasks = tasks;
    setTasks(prev => prev.filter(t => t.id !== taskId));
    
    const { error } = await supabase
      .from("tasks")
      .delete()
      .eq("id", taskId);

    if (error) {
      toast({ title: "Error", description: "Failed to delete task", variant: "destructive" });
      setTasks(previousTasks);
    } else {
      toast({ title: "Task Deleted", description: "Task has been removed." });
    }
  };

  return {
    tasks,
    loading,
    createTask,
    updateTask,
    updateTaskAssignees,
    updateTaskStatus,
    deleteTask,
    refetch: fetchTasks,
  };
}