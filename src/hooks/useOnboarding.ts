import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

interface OnboardingTask {
  id: string;
  workflow_id: string;
  title: string;
  description: string | null;
  task_type: string;
  is_completed: boolean;
  completed_at: string | null;
  completed_by: string | null;
  sort_order: number;
}

interface OnboardingWorkflow {
  id: string;
  employee_id: string;
  start_date: string;
  target_completion_date: string | null;
  status: "pending" | "in-progress" | "completed";
  completed_at: string | null;
  created_by: string;
  created_at: string;
  employee?: {
    first_name: string;
    last_name: string;
    job_title: string | null;
    department: string | null;
  };
  tasks?: OnboardingTask[];
}

interface OffboardingWorkflow {
  id: string;
  employee_id: string;
  resignation_date: string | null;
  last_working_date: string;
  reason: string | null;
  status: "pending" | "in-progress" | "completed";
  exit_interview_completed: boolean;
  assets_recovered: boolean;
  access_revoked: boolean;
  final_settlement_processed: boolean;
  created_by: string;
  created_at: string;
}

const DEFAULT_ONBOARDING_TASKS = [
  { title: "Send Offer Letter", description: "Generate and send offer letter for signature", task_type: "document", sort_order: 1 },
  { title: "Background Check", description: "Initiate background verification process", task_type: "compliance", sort_order: 2 },
  { title: "Sign NDA", description: "Collect signed NDA and employment contract", task_type: "document", sort_order: 3 },
  { title: "IT Setup Request", description: "Request equipment and system access", task_type: "it", sort_order: 4 },
  { title: "Schedule Orientation", description: "Schedule onboarding orientation session", task_type: "general", sort_order: 5 },
];

export function useOnboarding() {
  const { user, isManager } = useAuth();
  const [workflows, setWorkflows] = useState<OnboardingWorkflow[]>([]);
  const [offboardingWorkflows, setOffboardingWorkflows] = useState<OffboardingWorkflow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchWorkflows = useCallback(async () => {
    if (!isManager) {
      setLoading(false);
      return;
    }

    // Fetch onboarding workflows
    const { data: onboardingData, error: onboardingError } = await supabase
      .from("onboarding_workflows")
      .select(`
        *,
        employees:employee_id (
          first_name,
          last_name,
          job_title,
          department
        )
      `)
      .order("created_at", { ascending: false });

    if (!onboardingError && onboardingData) {
      // Fetch tasks for each workflow
      const workflowsWithTasks = await Promise.all(
        onboardingData.map(async (workflow) => {
          const { data: tasks } = await supabase
            .from("onboarding_tasks")
            .select("*")
            .eq("workflow_id", workflow.id)
            .order("sort_order", { ascending: true });

          return {
            ...workflow,
            employee: workflow.employees,
            tasks: tasks || [],
          } as OnboardingWorkflow;
        })
      );
      setWorkflows(workflowsWithTasks);
    }

    // Fetch offboarding workflows
    const { data: offboardingData, error: offboardingError } = await supabase
      .from("offboarding_workflows")
      .select("*")
      .order("created_at", { ascending: false });

    if (!offboardingError && offboardingData) {
      setOffboardingWorkflows(offboardingData as OffboardingWorkflow[]);
    }

    setLoading(false);
  }, [isManager]);

  useEffect(() => {
    fetchWorkflows();
  }, [fetchWorkflows]);

  const createOnboarding = async (employeeId: string, startDate: Date) => {
    if (!user || !isManager) {
      toast({ title: "Unauthorized", description: "Only managers can create onboarding", variant: "destructive" });
      return null;
    }

    // Create workflow
    const { data: workflow, error: workflowError } = await supabase
      .from("onboarding_workflows")
      .insert({
        employee_id: employeeId,
        start_date: startDate.toISOString().split("T")[0],
        target_completion_date: new Date(startDate.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        status: "pending",
        created_by: user.id,
      })
      .select()
      .single();

    if (workflowError) {
      toast({ title: "Error", description: "Failed to create onboarding workflow", variant: "destructive" });
      return null;
    }

    // Create default tasks
    const tasks = DEFAULT_ONBOARDING_TASKS.map(task => ({
      ...task,
      workflow_id: workflow.id,
      is_completed: false,
    }));

    const { error: tasksError } = await supabase.from("onboarding_tasks").insert(tasks);

    if (tasksError) {
      toast({ title: "Warning", description: "Workflow created but tasks failed to create", variant: "destructive" });
    } else {
      toast({ title: "Onboarding Created", description: "New hire onboarding workflow started" });
    }

    fetchWorkflows();
    return workflow;
  };

  const completeTask = async (taskId: string) => {
    if (!user || !isManager) return;

    const { error } = await supabase
      .from("onboarding_tasks")
      .update({
        is_completed: true,
        completed_at: new Date().toISOString(),
        completed_by: user.id,
      })
      .eq("id", taskId);

    if (error) {
      toast({ title: "Error", description: "Failed to complete task", variant: "destructive" });
    } else {
      toast({ title: "Task Completed", description: "Onboarding task marked complete" });
      fetchWorkflows();
    }
  };

  const createOffboarding = async (employeeId: string, lastWorkingDate: Date, reason?: string) => {
    if (!user || !isManager) {
      toast({ title: "Unauthorized", description: "Only managers can create offboarding", variant: "destructive" });
      return null;
    }

    const { data, error } = await supabase
      .from("offboarding_workflows")
      .insert({
        employee_id: employeeId,
        last_working_date: lastWorkingDate.toISOString().split("T")[0],
        resignation_date: new Date().toISOString().split("T")[0],
        reason,
        status: "pending",
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      toast({ title: "Error", description: "Failed to create offboarding workflow", variant: "destructive" });
      return null;
    }

    toast({ title: "Offboarding Started", description: "Employee offboarding workflow created" });
    fetchWorkflows();
    return data;
  };

  const updateOffboarding = async (workflowId: string, updates: Partial<OffboardingWorkflow>) => {
    if (!isManager) return;

    const { error } = await supabase
      .from("offboarding_workflows")
      .update(updates)
      .eq("id", workflowId);

    if (error) {
      toast({ title: "Error", description: "Failed to update offboarding", variant: "destructive" });
    } else {
      toast({ title: "Updated", description: "Offboarding status updated" });
      fetchWorkflows();
    }
  };

  const getProgress = (workflow: OnboardingWorkflow) => {
    if (!workflow.tasks || workflow.tasks.length === 0) return 0;
    const completed = workflow.tasks.filter(t => t.is_completed).length;
    return Math.round((completed / workflow.tasks.length) * 100);
  };

  return {
    workflows,
    offboardingWorkflows,
    loading,
    createOnboarding,
    completeTask,
    createOffboarding,
    updateOffboarding,
    getProgress,
    refetch: fetchWorkflows,
  };
}
