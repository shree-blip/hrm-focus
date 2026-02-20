import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

export interface TaskAssignee {
  user_id: string;
  assigned_by: string;
  assigned_at: string;
  assignee_name?: string;
  assigner_name?: string;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  client_name: string | null;
  client_id: string | null;
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
  comment_count?: number;
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
      const { data: assigneesData } = await supabase.from("task_assignees").select("*");

      // Fetch profiles for names
      const { data: profilesData } = await supabase.from("profiles").select("user_id, first_name, last_name");

      // Fetch comment counts per task
      const { data: commentsData } = await supabase
        .from("task_comments")
        .select("task_id");
      const commentCountMap = new Map<string, number>();
      (commentsData || []).forEach((c: { task_id: string }) => {
        commentCountMap.set(c.task_id, (commentCountMap.get(c.task_id) || 0) + 1);
      });

      const profileMap = new Map((profilesData || []).map((p) => [p.user_id, `${p.first_name} ${p.last_name}`]));

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

      // Build a set of task IDs where the current user is assigned
      const userAssignedTaskIds = new Set<string>();
      (assigneesData || []).forEach((a) => {
        if (a.user_id === userId) {
          userAssignedTaskIds.add(a.task_id);
        }
      });

      const allTasksWithAssignees: Task[] = (tasksData || []).map((task) => ({
        id: task.id,
        title: task.title,
        description: task.description,
        client_name: task.client_name,
        client_id: task.client_id,
        assignee_id: task.assignee_id,
        created_by: task.created_by,
        created_by_name: profileMap.get(task.created_by) || "Unknown",
        priority: (task.priority as "low" | "medium" | "high") || "medium",
        status: (task.status as "todo" | "in-progress" | "review" | "done") || "todo",
        due_date: task.due_date,
        time_estimate: task.time_estimate,
        is_recurring: task.is_recurring ?? false,
        created_at: task.created_at,
        assignees: assigneesByTask.get(task.id) || [],
        comment_count: commentCountMap.get(task.id) || 0,
      }));

      // FILTER: Only show tasks where the user is the creator OR is assigned
      const filteredTasks = allTasksWithAssignees.filter((task) => {
        // User created the task
        if (task.created_by === userId) return true;
        // User is assigned to the task
        if (userAssignedTaskIds.has(task.id)) return true;
        return false;
      });

      setTasks(filteredTasks);
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
      .on("postgres_changes", { event: "*", schema: "public", table: "task_assignees" }, () => fetchTasks())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchTasks]);

  const createTask = async (task: {
    title: string;
    description?: string;
    client_name?: string;
    client_id?: string;
    assignee_ids?: string[];
    priority: "low" | "medium" | "high";
    status: "todo" | "in-progress" | "review" | "done";
    due_date?: Date;
    time_estimate?: string;
    is_recurring?: boolean;
  }) => {
    if (!userId) return null;

    try {
      // Get org_id for the user
      let orgData = null;
      try {
        const { data } = await supabase.rpc("get_user_org_id", { _user_id: userId });
        orgData = data;
      } catch (rpcError) {
        console.warn("Error fetching org_id:", rpcError);
      }

      const { data, error } = await supabase
        .from("tasks")
        .insert({
          title: task.title,
          description: task.description,
          client_name: task.client_name,
          client_id: task.client_id || null,
          created_by: userId,
          priority: task.priority,
          status: task.status,
          due_date: task.due_date?.toISOString().split("T")[0],
          time_estimate: task.time_estimate,
          is_recurring: task.is_recurring || false,
          org_id: orgData || null,
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

      let createdAssignees: TaskAssignee[] = [];

      // Add assignees if provided
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
            description: "Task created but failed to assign users.",
            variant: "destructive",
          });
        } else {
          // Get the creator's name for notification message
          const { data: creatorProfile } = await supabase
            .from("profiles")
            .select("first_name, last_name")
            .eq("user_id", userId)
            .single();

          const creatorName = creatorProfile ? `${creatorProfile.first_name} ${creatorProfile.last_name}` : "Someone";

          // Create notifications for all assignees (except self)
          for (const assigneeId of task.assignee_ids) {
            if (assigneeId !== userId) {
              await supabase.from("notifications").insert({
                user_id: assigneeId,
                title: "New Task Assigned",
                message: `${creatorName} assigned you a new task: "${task.title}"`,
                type: "task",
                link: "/tasks",
              });
            }
          }

          createdAssignees = task.assignee_ids.map((id) => ({
            user_id: id,
            assigned_by: userId,
            assigned_at: new Date().toISOString(),
            assignee_name: "Loading...",
            assigner_name: "Me",
          }));
        }
      }

      toast({ title: "Task Created", description: "Your task has been added." });

      // Trigger a refresh from server
      fetchTasks();

      const fullTask: Task = {
        id: data.id,
        title: data.title,
        description: data.description,
        client_name: data.client_name,
        client_id: data.client_id,
        assignee_id: data.assignee_id,
        created_by: data.created_by,
        priority: (data.priority as "low" | "medium" | "high") || "medium",
        status: (data.status as "todo" | "in-progress" | "review" | "done") || "todo",
        due_date: data.due_date,
        time_estimate: data.time_estimate,
        is_recurring: data.is_recurring ?? false,
        created_at: data.created_at,
        assignees: createdAssignees,
      };

      return fullTask;
    } catch (error) {
      console.error("Unexpected error in createTask:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred.",
        variant: "destructive",
      });
      return null;
    }
  };

  const updateTask = async (taskId: string, updates: Partial<Task>) => {
    const { error } = await supabase
      .from("tasks")
      .update({
        title: updates.title,
        description: updates.description,
        client_name: updates.client_name,
        client_id: updates.client_id,
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
  };

  const updateTaskAssignees = async (taskId: string, assigneeIds: string[]) => {
    if (!userId) return;

    try {
      // Get existing assignees to determine new additions
      const { data: existingAssignees } = await supabase.from("task_assignees").select("user_id").eq("task_id", taskId);

      const existingIds = new Set((existingAssignees || []).map((a) => a.user_id));
      const newAssigneeIds = assigneeIds.filter((id) => !existingIds.has(id));

      // Delete existing assignees
      await supabase.from("task_assignees").delete().eq("task_id", taskId);

      // Add new assignees
      if (assigneeIds.length > 0) {
        const assigneeInserts = assigneeIds.map((assigneeUserId) => ({
          task_id: taskId,
          user_id: assigneeUserId,
          assigned_by: userId,
        }));

        const { error } = await supabase.from("task_assignees").insert(assigneeInserts);
        if (error) throw error;

        // Get task info and creator name for notification
        if (newAssigneeIds.length > 0) {
          const { data: taskData } = await supabase.from("tasks").select("title").eq("id", taskId).single();

          const { data: assignerProfile } = await supabase
            .from("profiles")
            .select("first_name, last_name")
            .eq("user_id", userId)
            .single();

          const assignerName = assignerProfile
            ? `${assignerProfile.first_name} ${assignerProfile.last_name}`
            : "Someone";

          // Notify new assignees only
          for (const assigneeId of newAssigneeIds) {
            if (assigneeId !== userId) {
              await supabase.from("notifications").insert({
                user_id: assigneeId,
                title: "Task Assigned",
                message: `${assignerName} assigned you to a task: "${taskData?.title || "Untitled"}"`,
                type: "task",
                link: "/tasks",
              });
            }
          }
        }
      }

      toast({ title: "Assignees Updated", description: "Task assignees have been updated." });
      fetchTasks();
    } catch (error) {
      console.error("Error updating assignees:", error);
      toast({ title: "Error", description: "Failed to update assignees", variant: "destructive" });
    }
  };

  const updateTaskStatus = async (taskId: string, newStatus: Task["status"]) => {
    // Optimistic update
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)));

    const { error } = await supabase.from("tasks").update({ status: newStatus }).eq("id", taskId);

    if (error) {
      toast({ title: "Error", description: "Failed to move task", variant: "destructive" });
      fetchTasks(); // Revert on error
    }
  };

  const deleteTask = async (taskId: string) => {
    const previousTasks = tasks;
    setTasks((prev) => prev.filter((t) => t.id !== taskId));

    const { error } = await supabase.from("tasks").delete().eq("id", taskId);

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
