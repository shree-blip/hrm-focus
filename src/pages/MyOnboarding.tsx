/**
 * MyOnboarding — Employee-only page showing their own onboarding progress.
 *
 * Queries the employee's onboarding workflow directly via their employee record
 * and displays tasks as a read-only checklist with progress tracking.
 * Employees cannot modify tasks — only management can toggle completion.
 */
import { useEffect, useState, useCallback, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle2, Circle, Loader2, UserPlus, FileText,
  Shield, Monitor, Users, BookOpen, ClipboardList,
} from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface OnboardingTask {
  id: string;
  title: string;
  description: string | null;
  task_type: string;
  is_completed: boolean;
  completed_at: string | null;
  sort_order: number;
}

interface MyWorkflow {
  id: string;
  status: string;
  start_date: string;
  target_completion_date: string | null;
  completed_at: string | null;
  created_at: string;
  tasks: OnboardingTask[];
}

const TASK_TYPE_ICON: Record<string, typeof FileText> = {
  offer_letter: FileText,
  background_check: Shield,
  nda: ClipboardList,
  it_setup: Monitor,
  orientation: BookOpen,
  general: Users,
};

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
    "in-progress": "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    completed: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  };
  return (
    <Badge className={map[status] || "bg-muted text-muted-foreground"}>
      {status === "in-progress" ? "In Progress" : status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

const MyOnboarding = () => {
  const { user } = useAuth();
  const [workflow, setWorkflow] = useState<MyWorkflow | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMyOnboarding = useCallback(async () => {
    if (!user) { setLoading(false); return; }

    try {
      // 1. Find employee record for the current user
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!profile) { setWorkflow(null); setLoading(false); return; }

      const { data: employee } = await supabase
        .from("employees")
        .select("id")
        .eq("profile_id", profile.id)
        .single();

      if (!employee) { setWorkflow(null); setLoading(false); return; }

      // 2. Fetch onboarding workflow for this employee
      const { data: wf, error } = await supabase
        .from("onboarding_workflows")
        .select("id, status, start_date, target_completion_date, completed_at, created_at")
        .eq("employee_id", employee.id)
        .neq("status", "cancelled")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !wf) { setWorkflow(null); setLoading(false); return; }

      // 3. Fetch tasks for this workflow
      const { data: tasks } = await supabase
        .from("onboarding_tasks")
        .select("id, title, description, task_type, is_completed, completed_at, sort_order")
        .eq("workflow_id", wf.id)
        .order("sort_order", { ascending: true });

      setWorkflow({
        ...wf,
        tasks: (tasks || []) as OnboardingTask[],
      });
    } catch (err) {
      console.error("Error fetching onboarding:", err);
      setWorkflow(null);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchMyOnboarding();
  }, [fetchMyOnboarding]);

  // Subscribe to realtime changes
  useEffect(() => {
    if (!workflow) return;
    const channel = supabase
      .channel("my-onboarding-tasks")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "onboarding_tasks", filter: `workflow_id=eq.${workflow.id}` },
        () => fetchMyOnboarding(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "onboarding_workflows", filter: `id=eq.${workflow.id}` },
        () => fetchMyOnboarding(),
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [workflow?.id, fetchMyOnboarding]);

  const completedCount = useMemo(
    () => workflow?.tasks.filter(t => t.is_completed).length ?? 0,
    [workflow],
  );
  const totalCount = workflow?.tasks.length ?? 0;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="animate-fade-in">
          <h1 className="text-2xl font-display font-bold tracking-tight">My Onboarding</h1>
          <p className="text-muted-foreground mt-1">
            Track your onboarding progress and see what&apos;s coming next.
          </p>
        </div>

        {!workflow ? (
          <Card className="animate-slide-up opacity-0" style={{ animationDelay: "100ms", animationFillMode: "forwards" }}>
            <CardContent className="py-12">
              <div className="text-center text-muted-foreground">
                <UserPlus className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium mb-2">No Onboarding Found</p>
                <p className="text-sm">
                  Your onboarding information will appear here once it&apos;s been set up by your manager.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Progress Card */}
            <Card className="animate-slide-up opacity-0" style={{ animationDelay: "100ms", animationFillMode: "forwards" }}>
              <CardContent className="pt-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-display font-semibold">Onboarding Progress</h2>
                      <StatusBadge status={workflow.status} />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Started {format(new Date(workflow.start_date + "T00:00:00"), "MMM d, yyyy")}
                      {workflow.target_completion_date && (
                        <> · Target: {format(new Date(workflow.target_completion_date + "T00:00:00"), "MMM d, yyyy")}</>
                      )}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-display font-bold text-primary">{progressPct}%</p>
                    <p className="text-xs text-muted-foreground">{completedCount} of {totalCount} tasks</p>
                  </div>
                </div>
                <Progress value={progressPct} className="h-2.5 mt-4" />
              </CardContent>
            </Card>

            {/* Tasks List */}
            <Card className="animate-slide-up opacity-0" style={{ animationDelay: "200ms", animationFillMode: "forwards" }}>
              <CardHeader>
                <CardTitle className="font-display text-lg flex items-center gap-2">
                  <ClipboardList className="h-5 w-5 text-primary" />
                  Onboarding Tasks
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {workflow.tasks.map((task, idx) => {
                    const IconComp = TASK_TYPE_ICON[task.task_type] || ClipboardList;
                    return (
                      <div
                        key={task.id}
                        className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors animate-fade-in"
                        style={{ animationDelay: `${300 + idx * 50}ms` }}
                      >
                        {task.is_completed ? (
                          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                        ) : (
                          <Circle className="h-5 w-5 text-muted-foreground/40 mt-0.5 shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className={`font-medium text-sm ${task.is_completed ? "line-through text-muted-foreground" : ""}`}>
                            {task.title}
                          </p>
                          {task.description && (
                            <p className="text-xs text-muted-foreground mt-0.5">{task.description}</p>
                          )}
                          {task.is_completed && task.completed_at && (
                            <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                              Completed {format(new Date(task.completed_at), "MMM d, yyyy")}
                            </p>
                          )}
                        </div>
                        <div className="shrink-0 h-8 w-8 rounded-md bg-muted flex items-center justify-center">
                          <IconComp className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default MyOnboarding;
