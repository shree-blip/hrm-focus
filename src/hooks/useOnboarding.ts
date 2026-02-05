import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

interface OnboardingTask {
  id: string;
  workflow_id: string;
  title: string;
  description: string | null;
  task_type: "offer_letter" | "background_check" | "nda" | "it_setup" | "orientation" | "general";
  is_completed: boolean;
  completed_at: string | null;
  completed_by: string | null;
  sort_order: number;
  created_at: string;
}

interface OnboardingWorkflow {
  id: string;
  employee_id: string;
  start_date: string;
  target_completion_date: string | null;
  status: "pending" | "in-progress" | "completed" | "cancelled";
  completed_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  employee?: {
    id: string;
    first_name: string;
    last_name: string;
    job_title: string | null;
    department: string | null;
    email: string | null;
  };
  tasks?: OnboardingTask[];
}

interface OffboardingWorkflow {
  id: string;
  employee_id: string;
  resignation_date: string | null;
  last_working_date: string;
  reason: string | null;
  status: "pending" | "in-progress" | "completed" | "cancelled";
  exit_interview_completed: boolean;
  assets_recovered: boolean;
  access_revoked: boolean;
  final_settlement_processed: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface NewHireData {
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  department: string;
  startDate: string;
  phone?: string;
  salary?: number;
}

const DEFAULT_ONBOARDING_TASKS: Array<{
  title: string;
  description: string;
  task_type: "offer_letter" | "background_check" | "nda" | "it_setup" | "orientation" | "general";
  sort_order: number;
}> = [
  {
    title: "Send Offer Letter",
    description: "Generate and send offer letter for signature",
    task_type: "offer_letter",
    sort_order: 1,
  },
  {
    title: "Background Check",
    description: "Initiate background verification process",
    task_type: "background_check",
    sort_order: 2,
  },
  {
    title: "Sign NDA & Contracts",
    description: "Collect signed NDA and employment contract",
    task_type: "nda",
    sort_order: 3,
  },
  {
    title: "IT Setup Request",
    description: "Request equipment and system access",
    task_type: "it_setup",
    sort_order: 4,
  },
  {
    title: "Schedule Orientation",
    description: "Schedule onboarding orientation session",
    task_type: "orientation",
    sort_order: 5,
  },
  {
    title: "Complete I-9 Form",
    description: "Verify employment eligibility documentation",
    task_type: "general",
    sort_order: 6,
  },
  {
    title: "Setup Direct Deposit",
    description: "Collect banking information for payroll",
    task_type: "general",
    sort_order: 7,
  },
  {
    title: "Assign Mentor/Buddy",
    description: "Pair new hire with a team member for guidance",
    task_type: "general",
    sort_order: 8,
  },
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

    try {
      // Fetch onboarding workflows with employee data
      const { data: onboardingData, error: onboardingError } = await supabase
        .from("onboarding_workflows")
        .select(
          `
          *,
          employees:employee_id (
            id,
            first_name,
            last_name,
            job_title,
            department,
            email
          )
        `,
        )
        .neq("status", "cancelled")
        .order("created_at", { ascending: false });

      if (onboardingError) {
        console.error("Error fetching onboarding workflows:", onboardingError);
        toast({ title: "Error", description: "Failed to fetch onboarding data", variant: "destructive" });
      } else if (onboardingData) {
        // Fetch tasks for each workflow
        const workflowsWithTasks = await Promise.all(
          onboardingData.map(async (workflow) => {
            const { data: tasks, error: tasksError } = await supabase
              .from("onboarding_tasks")
              .select("*")
              .eq("workflow_id", workflow.id)
              .order("sort_order", { ascending: true });

            if (tasksError) {
              console.error("Error fetching tasks for workflow:", workflow.id, tasksError);
            }

            return {
              ...workflow,
              employee: workflow.employees,
              tasks: tasks || [],
            } as OnboardingWorkflow;
          }),
        );
        setWorkflows(workflowsWithTasks);
      }

      // Fetch offboarding workflows
      const { data: offboardingData, error: offboardingError } = await supabase
        .from("offboarding_workflows")
        .select("*")
        .neq("status", "cancelled")
        .order("created_at", { ascending: false });

      if (offboardingError) {
        console.error("Error fetching offboarding workflows:", offboardingError);
      } else if (offboardingData) {
        setOffboardingWorkflows(offboardingData as OffboardingWorkflow[]);
      }
    } catch (err) {
      console.error("Unexpected error in fetchWorkflows:", err);
    } finally {
      setLoading(false);
    }
  }, [isManager]);

  useEffect(() => {
    fetchWorkflows();
  }, [fetchWorkflows]);

  // Set up real-time subscriptions
  useEffect(() => {
    if (!isManager) return;

    const workflowChannel = supabase
      .channel("onboarding-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "onboarding_workflows" }, () => {
        fetchWorkflows();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "onboarding_tasks" }, () => {
        fetchWorkflows();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "offboarding_workflows" }, () => {
        fetchWorkflows();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(workflowChannel);
    };
  }, [isManager, fetchWorkflows]);

  // Create a new employee and start onboarding
  const createNewHireWithOnboarding = async (hireData: NewHireData) => {
    if (!user || !isManager) {
      toast({ title: "Unauthorized", description: "Only managers can create onboarding", variant: "destructive" });
      return null;
    }

    try {
      // Step 1: Check if employee already exists by email
      const { data: existingEmployee } = await supabase
        .from("employees")
        .select("id, first_name, last_name")
        .eq("email", hireData.email.toLowerCase())
        .maybeSingle();

      let employeeId: string;
      let employeeName: string;

      if (existingEmployee) {
        // Check if they already have an active onboarding
        const { data: existingWorkflow } = await supabase
          .from("onboarding_workflows")
          .select("id")
          .eq("employee_id", existingEmployee.id)
          .in("status", ["pending", "in-progress"])
          .maybeSingle();

        if (existingWorkflow) {
          toast({
            title: "Already Onboarding",
            description: `${existingEmployee.first_name} ${existingEmployee.last_name} already has an active onboarding workflow.`,
            variant: "destructive",
          });
          return null;
        }
        employeeId = existingEmployee.id;
        employeeName = `${existingEmployee.first_name} ${existingEmployee.last_name}`;
      } else {
        // Step 2: Create new employee record
        // Match the actual employees table schema
        const employeeData = {
          first_name: hireData.firstName.trim(),
          last_name: hireData.lastName.trim(),
          email: hireData.email.toLowerCase().trim(),
          job_title: hireData.role.trim(),
          department: hireData.department,
          phone: hireData.phone?.trim() || null,
          status: "probation" as const, // New hires start in probation (valid: active, probation, inactive, on_leave)
          hire_date: hireData.startDate,
          pay_type: "salary" as const, // Default to salary (valid: hourly, salary, contractor)
          ...(hireData.salary && { salary: hireData.salary }),
        };

        const { data: newEmployee, error: employeeError } = await supabase
          .from("employees")
          .insert(employeeData)
          .select("id")
          .single();

        if (employeeError) {
          console.error("Error creating employee:", employeeError);
          toast({
            title: "Error",
            description: employeeError.message || "Failed to create employee record",
            variant: "destructive",
          });
          return null;
        }
        employeeId = newEmployee.id;
        employeeName = `${hireData.firstName} ${hireData.lastName}`;
      }

      // Step 3: Create onboarding workflow
      const startDate = new Date(hireData.startDate);
      const targetDate = new Date(startDate.getTime() + 14 * 24 * 60 * 60 * 1000); // 2 weeks

      const { data: workflow, error: workflowError } = await supabase
        .from("onboarding_workflows")
        .insert({
          employee_id: employeeId,
          start_date: hireData.startDate,
          target_completion_date: targetDate.toISOString().split("T")[0],
          status: "pending",
          created_by: user.id,
        })
        .select()
        .single();

      if (workflowError) {
        console.error("Error creating workflow:", workflowError);
        toast({
          title: "Error",
          description: workflowError.message || "Failed to create onboarding workflow",
          variant: "destructive",
        });
        return null;
      }

      // Step 4: Create default onboarding tasks
      const tasks = DEFAULT_ONBOARDING_TASKS.map((task) => ({
        workflow_id: workflow.id,
        title: task.title,
        description: task.description,
        task_type: task.task_type,
        sort_order: task.sort_order,
        is_completed: false,
      }));

      const { error: tasksError } = await supabase.from("onboarding_tasks").insert(tasks);

      if (tasksError) {
        console.error("Error creating tasks:", tasksError);
        // Don't fail completely, workflow was created
        toast({
          title: "Partial Success",
          description: "Workflow created but some tasks failed to create",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Onboarding Started",
          description: `${employeeName} has been added to onboarding successfully.`,
        });
      }

      // Refresh the data
      await fetchWorkflows();
      return workflow;
    } catch (err) {
      console.error("Unexpected error in createNewHireWithOnboarding:", err);
      toast({ title: "Error", description: "An unexpected error occurred", variant: "destructive" });
      return null;
    }
  };

  // Create onboarding for an existing employee
  const createOnboarding = async (employeeId: string, startDate: Date) => {
    if (!user || !isManager) {
      toast({ title: "Unauthorized", description: "Only managers can create onboarding", variant: "destructive" });
      return null;
    }

    try {
      // Check for existing active workflow
      const { data: existingWorkflow } = await supabase
        .from("onboarding_workflows")
        .select("id")
        .eq("employee_id", employeeId)
        .in("status", ["pending", "in-progress"])
        .maybeSingle();

      if (existingWorkflow) {
        toast({
          title: "Already Onboarding",
          description: "This employee already has an active onboarding workflow.",
          variant: "destructive",
        });
        return null;
      }

      const targetDate = new Date(startDate.getTime() + 14 * 24 * 60 * 60 * 1000);

      const { data: workflow, error: workflowError } = await supabase
        .from("onboarding_workflows")
        .insert({
          employee_id: employeeId,
          start_date: startDate.toISOString().split("T")[0],
          target_completion_date: targetDate.toISOString().split("T")[0],
          status: "pending",
          created_by: user.id,
        })
        .select()
        .single();

      if (workflowError) {
        console.error("Error creating workflow:", workflowError);
        toast({ title: "Error", description: "Failed to create onboarding workflow", variant: "destructive" });
        return null;
      }

      // Create default tasks
      const tasks = DEFAULT_ONBOARDING_TASKS.map((task) => ({
        workflow_id: workflow.id,
        title: task.title,
        description: task.description,
        task_type: task.task_type,
        sort_order: task.sort_order,
        is_completed: false,
      }));

      const { error: tasksError } = await supabase.from("onboarding_tasks").insert(tasks);

      if (tasksError) {
        console.error("Error creating tasks:", tasksError);
      }

      toast({ title: "Onboarding Created", description: "New hire onboarding workflow started" });
      await fetchWorkflows();
      return workflow;
    } catch (err) {
      console.error("Error in createOnboarding:", err);
      toast({ title: "Error", description: "An unexpected error occurred", variant: "destructive" });
      return null;
    }
  };

  // Complete a task and update workflow status accordingly
  const completeTask = async (taskId: string) => {
    if (!user || !isManager) return;

    try {
      // Get the task to find the workflow
      const { data: task, error: taskFetchError } = await supabase
        .from("onboarding_tasks")
        .select("workflow_id")
        .eq("id", taskId)
        .single();

      if (taskFetchError || !task) {
        toast({ title: "Error", description: "Task not found", variant: "destructive" });
        return;
      }

      // Update the task as completed
      const { error: updateError } = await supabase
        .from("onboarding_tasks")
        .update({
          is_completed: true,
          completed_at: new Date().toISOString(),
          completed_by: user.id,
        })
        .eq("id", taskId);

      if (updateError) {
        console.error("Error completing task:", updateError);
        toast({ title: "Error", description: "Failed to complete task", variant: "destructive" });
        return;
      }

      // Get all tasks for this workflow to determine new status
      const { data: allTasks } = await supabase
        .from("onboarding_tasks")
        .select("is_completed")
        .eq("workflow_id", task.workflow_id);

      if (allTasks) {
        const completedCount = allTasks.filter((t) => t.is_completed).length;
        const totalTasks = allTasks.length;

        let newStatus: "pending" | "in-progress" | "completed" = "pending";
        let completedAt: string | null = null;

        if (completedCount === totalTasks) {
          newStatus = "completed";
          completedAt = new Date().toISOString();

          // Update employee status to active when onboarding completes
          const { data: workflow } = await supabase
            .from("onboarding_workflows")
            .select("employee_id")
            .eq("id", task.workflow_id)
            .single();

          if (workflow) {
            await supabase
              .from("employees")
              .update({ status: "active" }) // Valid status: active, probation, inactive, on_leave
              .eq("id", workflow.employee_id);
          }

          toast({
            title: "🎉 Onboarding Complete!",
            description: "All tasks finished. Employee is now active.",
          });
        } else if (completedCount > 0) {
          newStatus = "in-progress";
          toast({ title: "Task Completed", description: `${completedCount}/${totalTasks} tasks done` });
        }

        // Update workflow status
        await supabase
          .from("onboarding_workflows")
          .update({
            status: newStatus,
            completed_at: completedAt,
          })
          .eq("id", task.workflow_id);
      }

      await fetchWorkflows();
    } catch (err) {
      console.error("Error in completeTask:", err);
      toast({ title: "Error", description: "An unexpected error occurred", variant: "destructive" });
    }
  };

  // Uncomplete a task (undo)
  const uncompleteTask = async (taskId: string) => {
    if (!user || !isManager) return;

    try {
      const { data: task } = await supabase.from("onboarding_tasks").select("workflow_id").eq("id", taskId).single();

      if (!task) return;

      // Mark task as incomplete
      await supabase
        .from("onboarding_tasks")
        .update({
          is_completed: false,
          completed_at: null,
          completed_by: null,
        })
        .eq("id", taskId);

      // Recalculate workflow status
      const { data: allTasks } = await supabase
        .from("onboarding_tasks")
        .select("is_completed")
        .eq("workflow_id", task.workflow_id);

      if (allTasks) {
        // Subtract 1 because we just uncompleted one
        const completedCount = allTasks.filter((t) => t.is_completed).length - 1;
        const newStatus = completedCount > 0 ? "in-progress" : "pending";

        // Get current workflow status to check if it was completed
        const { data: currentWorkflow } = await supabase
          .from("onboarding_workflows")
          .select("employee_id, status")
          .eq("id", task.workflow_id)
          .single();

        await supabase
          .from("onboarding_workflows")
          .update({
            status: newStatus,
            completed_at: null,
          })
          .eq("id", task.workflow_id);

        // If workflow was previously completed, revert employee status to probation
        if (currentWorkflow && currentWorkflow.status === "completed") {
          await supabase
            .from("employees")
            .update({ status: "probation" }) // Revert to probation
            .eq("id", currentWorkflow.employee_id);
        }
      }

      toast({ title: "Task Reopened", description: "Task marked as incomplete" });
      await fetchWorkflows();
    } catch (err) {
      console.error("Error in uncompleteTask:", err);
    }
  };

  // Toggle task completion status
  const toggleTask = async (taskId: string, currentlyCompleted: boolean) => {
    if (currentlyCompleted) {
      await uncompleteTask(taskId);
    } else {
      await completeTask(taskId);
    }
  };

  // Cancel/Delete an onboarding workflow
  const deleteOnboarding = async (workflowId: string) => {
    if (!user || !isManager) return;

    try {
      // Get workflow to find employee
      const { data: workflow } = await supabase
        .from("onboarding_workflows")
        .select("employee_id, status")
        .eq("id", workflowId)
        .single();

      // Delete tasks first (due to foreign key)
      await supabase.from("onboarding_tasks").delete().eq("workflow_id", workflowId);

      // Delete workflow
      const { error } = await supabase.from("onboarding_workflows").delete().eq("id", workflowId);

      if (error) {
        console.error("Error deleting workflow:", error);
        toast({ title: "Error", description: "Failed to delete onboarding", variant: "destructive" });
        return;
      }

      // If employee was in onboarding status, you may want to handle this
      // For now we'll leave the employee record intact

      toast({ title: "Deleted", description: "Onboarding workflow removed" });
      await fetchWorkflows();
    } catch (err) {
      console.error("Error in deleteOnboarding:", err);
    }
  };

  // Cancel onboarding (soft delete)
  const cancelOnboarding = async (workflowId: string) => {
    if (!user || !isManager) return;

    try {
      const { error } = await supabase
        .from("onboarding_workflows")
        .update({ status: "cancelled" })
        .eq("id", workflowId);

      if (error) {
        toast({ title: "Error", description: "Failed to cancel onboarding", variant: "destructive" });
        return;
      }

      toast({ title: "Cancelled", description: "Onboarding workflow cancelled" });
      await fetchWorkflows();
    } catch (err) {
      console.error("Error in cancelOnboarding:", err);
    }
  };

  // ==================== OFFBOARDING ====================

  const createOffboarding = async (employeeId: string, lastWorkingDate: Date, reason?: string) => {
    if (!user || !isManager) {
      toast({ title: "Unauthorized", description: "Only managers can create offboarding", variant: "destructive" });
      return null;
    }

    try {
      // Check for existing active offboarding
      const { data: existing } = await supabase
        .from("offboarding_workflows")
        .select("id")
        .eq("employee_id", employeeId)
        .in("status", ["pending", "in-progress"])
        .maybeSingle();

      if (existing) {
        toast({
          title: "Already Offboarding",
          description: "This employee already has an active offboarding workflow.",
          variant: "destructive",
        });
        return null;
      }

      const { data, error } = await supabase
        .from("offboarding_workflows")
        .insert({
          employee_id: employeeId,
          last_working_date: lastWorkingDate.toISOString().split("T")[0],
          resignation_date: new Date().toISOString().split("T")[0],
          reason: reason || null,
          status: "pending",
          exit_interview_completed: false,
          assets_recovered: false,
          access_revoked: false,
          final_settlement_processed: false,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) {
        console.error("Error creating offboarding:", error);
        toast({ title: "Error", description: "Failed to create offboarding workflow", variant: "destructive" });
        return null;
      }

      // Note: Not updating employee status here since 'offboarding' is not a valid status
      // Employee remains 'active' until offboarding completes

      toast({ title: "Offboarding Started", description: "Employee offboarding workflow created" });
      await fetchWorkflows();
      return data;
    } catch (err) {
      console.error("Error in createOffboarding:", err);
      toast({ title: "Error", description: "An unexpected error occurred", variant: "destructive" });
      return null;
    }
  };

  const updateOffboarding = async (workflowId: string, updates: Partial<OffboardingWorkflow>) => {
    if (!isManager) return;

    try {
      // Get current state
      const { data: current } = await supabase.from("offboarding_workflows").select("*").eq("id", workflowId).single();

      if (!current) return;

      const merged = { ...current, ...updates };

      // Check if all checklist items are complete
      const allComplete =
        merged.exit_interview_completed &&
        merged.assets_recovered &&
        merged.access_revoked &&
        merged.final_settlement_processed;

      // Determine new status
      const hasAnyComplete =
        merged.exit_interview_completed ||
        merged.assets_recovered ||
        merged.access_revoked ||
        merged.final_settlement_processed;

      const newStatus = allComplete ? "completed" : hasAnyComplete ? "in-progress" : "pending";

      const { error } = await supabase
        .from("offboarding_workflows")
        .update({
          ...updates,
          status: newStatus,
        })
        .eq("id", workflowId);

      if (error) {
        console.error("Error updating offboarding:", error);
        toast({ title: "Error", description: "Failed to update offboarding", variant: "destructive" });
        return;
      }

      // If completed, update employee status to inactive
      if (allComplete && current.status !== "completed") {
        await supabase
          .from("employees")
          .update({
            status: "inactive",
            termination_date: new Date().toISOString().split("T")[0],
          })
          .eq("id", current.employee_id);

        toast({
          title: "🏁 Offboarding Complete",
          description: "All tasks finished. Employee marked as inactive.",
        });
      } else {
        toast({ title: "Updated", description: "Offboarding progress saved" });
      }

      await fetchWorkflows();
    } catch (err) {
      console.error("Error in updateOffboarding:", err);
    }
  };

  // Helper: Calculate onboarding progress percentage
  const getProgress = (workflow: OnboardingWorkflow) => {
    if (!workflow.tasks || workflow.tasks.length === 0) return 0;
    const completed = workflow.tasks.filter((t) => t.is_completed).length;
    return Math.round((completed / workflow.tasks.length) * 100);
  };

  // Helper: Calculate offboarding progress percentage
  const getOffboardingProgress = (workflow: OffboardingWorkflow) => {
    const items = [
      workflow.exit_interview_completed,
      workflow.assets_recovered,
      workflow.access_revoked,
      workflow.final_settlement_processed,
    ];
    return Math.round((items.filter(Boolean).length / items.length) * 100);
  };

  return {
    workflows,
    offboardingWorkflows,
    loading,
    createOnboarding,
    createNewHireWithOnboarding,
    completeTask,
    uncompleteTask,
    toggleTask,
    deleteOnboarding,
    cancelOnboarding,
    createOffboarding,
    updateOffboarding,
    getProgress,
    getOffboardingProgress,
    refetch: fetchWorkflows,
  };
}
