/**
 * MyOffboarding — Employee-only page showing their own offboarding progress.
 *
 * Queries the employee's offboarding workflow directly via their employee record
 * and displays checklist steps as a read-only timeline with progress tracking.
 * Employees cannot modify steps — only management can toggle completion.
 */
import { useEffect, useState, useCallback, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle2, Circle, Loader2, UserMinus, MessageSquare,
  Package, ShieldOff, Banknote, CalendarClock, ClipboardList,
} from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface MyOffboardingWorkflow {
  id: string;
  status: string;
  resignation_date: string | null;
  last_working_date: string;
  reason: string | null;
  exit_interview_completed: boolean;
  assets_recovered: boolean;
  access_revoked: boolean;
  final_settlement_processed: boolean;
  created_at: string;
  updated_at: string;
}

interface OffboardingStep {
  key: string;
  label: string;
  description: string;
  completed: boolean;
  icon: typeof MessageSquare;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
    "in-progress": "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    completed: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
    cancelled: "bg-muted text-muted-foreground",
  };
  return (
    <Badge className={map[status] || "bg-muted text-muted-foreground"}>
      {status === "in-progress" ? "In Progress" : status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

function buildSteps(wf: MyOffboardingWorkflow): OffboardingStep[] {
  return [
    {
      key: "exit_interview",
      label: "Exit Interview",
      description: "Complete your exit interview with HR or your manager.",
      completed: wf.exit_interview_completed,
      icon: MessageSquare,
    },
    {
      key: "assets_recovered",
      label: "Return Company Assets",
      description: "Return all company equipment, keys, and access cards.",
      completed: wf.assets_recovered,
      icon: Package,
    },
    {
      key: "access_revoked",
      label: "Access Revocation",
      description: "System and building access will be revoked by IT.",
      completed: wf.access_revoked,
      icon: ShieldOff,
    },
    {
      key: "final_settlement",
      label: "Final Settlement",
      description: "Final pay, leave encashment, and any pending reimbursements.",
      completed: wf.final_settlement_processed,
      icon: Banknote,
    },
  ];
}

const MyOffboarding = () => {
  const { user } = useAuth();
  const [workflow, setWorkflow] = useState<MyOffboardingWorkflow | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMyOffboarding = useCallback(async () => {
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

      // 2. Fetch offboarding workflow for this employee
      const { data: wf, error } = await (supabase as unknown as any)
        .from("offboarding_workflows")
        .select("id, status, resignation_date, last_working_date, reason, exit_interview_completed, assets_recovered, access_revoked, final_settlement_processed, created_at, updated_at")
        .eq("employee_id", employee.id)
        .neq("status", "cancelled")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !wf) { setWorkflow(null); setLoading(false); return; }

      setWorkflow(wf as MyOffboardingWorkflow);
    } catch (err) {
      console.error("Error fetching offboarding:", err);
      setWorkflow(null);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchMyOffboarding();
  }, [fetchMyOffboarding]);

  // Subscribe to realtime changes
  useEffect(() => {
    if (!workflow) return;
    const channel = supabase
      .channel("my-offboarding")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "offboarding_workflows", filter: `id=eq.${workflow.id}` },
        () => fetchMyOffboarding(),
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [workflow?.id, fetchMyOffboarding]);

  const steps = useMemo(() => (workflow ? buildSteps(workflow) : []), [workflow]);
  const completedCount = steps.filter((s) => s.completed).length;
  const totalCount = steps.length;
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
          <h1 className="text-2xl font-display font-bold tracking-tight">My Offboarding</h1>
          <p className="text-muted-foreground mt-1">
            Track your offboarding progress and remaining steps.
          </p>
        </div>

        {!workflow ? (
          <Card className="animate-slide-up opacity-0" style={{ animationDelay: "100ms", animationFillMode: "forwards" }}>
            <CardContent className="py-12">
              <div className="text-center text-muted-foreground">
                <UserMinus className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium mb-2">No Offboarding Found</p>
                <p className="text-sm">
                  No offboarding process has been initiated for your account.
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
                      <h2 className="text-lg font-display font-semibold">Offboarding Progress</h2>
                      <StatusBadge status={workflow.status} />
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      {workflow.resignation_date && (
                        <span className="flex items-center gap-1">
                          <CalendarClock className="h-3.5 w-3.5" />
                          Resigned: {format(new Date(workflow.resignation_date + "T00:00:00"), "MMM d, yyyy")}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <CalendarClock className="h-3.5 w-3.5" />
                        Last Day: {format(new Date(workflow.last_working_date + "T00:00:00"), "MMM d, yyyy")}
                      </span>
                    </div>
                    {workflow.reason && (
                      <p className="text-xs text-muted-foreground italic mt-1">Reason: {workflow.reason}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-display font-bold text-primary">{progressPct}%</p>
                    <p className="text-xs text-muted-foreground">{completedCount} of {totalCount} steps</p>
                  </div>
                </div>
                <Progress value={progressPct} className="h-2.5 mt-4" />
              </CardContent>
            </Card>

            {/* Steps Checklist */}
            <Card className="animate-slide-up opacity-0" style={{ animationDelay: "200ms", animationFillMode: "forwards" }}>
              <CardHeader>
                <CardTitle className="font-display text-lg flex items-center gap-2">
                  <ClipboardList className="h-5 w-5 text-primary" />
                  Offboarding Steps
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {steps.map((step, idx) => {
                    const IconComp = step.icon;
                    return (
                      <div
                        key={step.key}
                        className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors animate-fade-in"
                        style={{ animationDelay: `${300 + idx * 50}ms` }}
                      >
                        {step.completed ? (
                          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                        ) : (
                          <Circle className="h-5 w-5 text-muted-foreground/40 mt-0.5 shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className={`font-medium text-sm ${step.completed ? "line-through text-muted-foreground" : ""}`}>
                            {step.label}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
                          {step.completed && (
                            <p className="text-xs text-green-600 dark:text-green-400 mt-1">Completed</p>
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

export default MyOffboarding;
