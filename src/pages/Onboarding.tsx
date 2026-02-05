import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  CheckCircle2,
  Circle,
  UserPlus,
  FileText,
  Mail,
  Laptop,
  Key,
  LogOut,
  Loader2,
  UserMinus,
  Trash2,
  Clock,
  Calendar,
  AlertCircle,
  RefreshCw,
  ClipboardCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useOnboarding } from "@/hooks/useOnboarding";
import { useEmployees } from "@/hooks/useEmployees";
import { NewHireDialog } from "@/components/onboarding/NewHireDialog";
import { format, formatDistanceToNow, isPast, isToday } from "date-fns";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const onboardingSteps = [
  { icon: FileText, title: "Offer Letter", description: "Generate and send offer letter for signature" },
  { icon: CheckCircle2, title: "Background Check", description: "Initiate background verification process" },
  { icon: Key, title: "NDA & Contracts", description: "Collect signed NDA and employment contract" },
  { icon: Laptop, title: "IT Setup", description: "Request equipment and system access" },
  { icon: Mail, title: "Orientation", description: "Schedule onboarding orientation session" },
];

const Onboarding = () => {
  const {
    workflows,
    offboardingWorkflows,
    loading,
    createNewHireWithOnboarding,
    toggleTask,
    deleteOnboarding,
    createOffboarding,
    updateOffboarding,
    getProgress,
    getOffboardingProgress,
    refetch,
  } = useOnboarding();
  const { employees } = useEmployees();

  const [activeTab, setActiveTab] = useState<"onboarding" | "offboarding">("onboarding");
  const [newHireDialogOpen, setNewHireDialogOpen] = useState(false);
  const [offboardingDialogOpen, setOffboardingDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [workflowToDelete, setWorkflowToDelete] = useState<string | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [lastWorkingDate, setLastWorkingDate] = useState("");
  const [offboardingReason, setOffboardingReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleNewHire = async (hireData: any) => {
    return await createNewHireWithOnboarding(hireData);
  };

  const handleStartOffboarding = async () => {
    if (!selectedEmployeeId || !lastWorkingDate) {
      toast({
        title: "Missing Information",
        description: "Please select an employee and last working date.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await createOffboarding(selectedEmployeeId, new Date(lastWorkingDate), offboardingReason);
      setOffboardingDialogOpen(false);
      setSelectedEmployeeId("");
      setLastWorkingDate("");
      setOffboardingReason("");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteWorkflow = async () => {
    if (!workflowToDelete) return;
    await deleteOnboarding(workflowToDelete);
    setDeleteDialogOpen(false);
    setWorkflowToDelete(null);
  };

  const confirmDelete = (workflowId: string) => {
    setWorkflowToDelete(workflowId);
    setDeleteDialogOpen(true);
  };

  const activeWorkflows = workflows.filter((w) => w.status !== "completed");
  const completedWorkflows = workflows.filter((w) => w.status === "completed");
  const activeOffboarding = offboardingWorkflows.filter((w) => w.status !== "completed");

  const thisMonth = new Date();
  thisMonth.setDate(1);
  const completedThisMonth = completedWorkflows.filter(
    (w) => w.completed_at && new Date(w.completed_at) >= thisMonth,
  ).length;

  const startingSoon = activeWorkflows.filter((w) => {
    const startDate = new Date(w.start_date);
    const daysUntil = Math.ceil((startDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return daysUntil <= 7 && daysUntil >= 0;
  });

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
      <TooltipProvider>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 animate-fade-in">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Onboarding</h1>
            <p className="text-muted-foreground mt-1">Manage new hire onboarding and employee offboarding</p>
          </div>
          <div className="flex gap-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={refetch}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh data</TooltipContent>
            </Tooltip>
            <Button variant="outline" className="gap-2" onClick={() => setOffboardingDialogOpen(true)}>
              <UserMinus className="h-4 w-4" />
              Start Offboarding
            </Button>
            <Button className="gap-2 shadow-md" onClick={() => setNewHireDialogOpen(true)}>
              <UserPlus className="h-4 w-4" />
              New Hire
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "onboarding" | "offboarding")} className="mb-6">
          <TabsList>
            <TabsTrigger value="onboarding" className="gap-2">
              Onboarding
              {activeWorkflows.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {activeWorkflows.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="offboarding" className="gap-2">
              Offboarding
              {activeOffboarding.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {activeOffboarding.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {activeTab === "onboarding" ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-6 mb-8">
              <Card
                className="animate-slide-up opacity-0"
                style={{ animationDelay: "100ms", animationFillMode: "forwards" }}
              >
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Active Onboarding</p>
                      <p className="text-3xl font-display font-bold mt-1">{activeWorkflows.length}</p>
                    </div>
                    <div className="h-12 w-12 rounded-xl bg-warning/10 flex items-center justify-center">
                      <UserPlus className="h-6 w-6 text-warning" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card
                className="animate-slide-up opacity-0"
                style={{ animationDelay: "150ms", animationFillMode: "forwards" }}
              >
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Starting Soon</p>
                      <p className="text-3xl font-display font-bold mt-1">{startingSoon.length}</p>
                    </div>
                    <div className="h-12 w-12 rounded-xl bg-info/10 flex items-center justify-center">
                      <Calendar className="h-6 w-6 text-info" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card
                className="animate-slide-up opacity-0"
                style={{ animationDelay: "200ms", animationFillMode: "forwards" }}
              >
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Completed This Month</p>
                      <p className="text-3xl font-display font-bold mt-1">{completedThisMonth}</p>
                    </div>
                    <div className="h-12 w-12 rounded-xl bg-success/10 flex items-center justify-center">
                      <CheckCircle2 className="h-6 w-6 text-success" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card
                className="animate-slide-up opacity-0"
                style={{ animationDelay: "250ms", animationFillMode: "forwards" }}
              >
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Completed</p>
                      <p className="text-3xl font-display font-bold mt-1">{completedWorkflows.length}</p>
                    </div>
                    <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                      <ClipboardCheck className="h-6 w-6 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <h2 className="text-lg font-display font-semibold animate-fade-in" style={{ animationDelay: "300ms" }}>
                  Active Onboarding ({activeWorkflows.length})
                </h2>

                {activeWorkflows.length === 0 ? (
                  <Card
                    className="animate-slide-up opacity-0"
                    style={{ animationDelay: "350ms", animationFillMode: "forwards" }}
                  >
                    <CardContent className="py-12 text-center text-muted-foreground">
                      <UserPlus className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p className="font-medium">No active onboarding workflows</p>
                      <p className="text-sm mt-1">Add a new hire to get started</p>
                      <Button className="mt-4" onClick={() => setNewHireDialogOpen(true)}>
                        <UserPlus className="mr-2 h-4 w-4" />
                        Add New Hire
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  activeWorkflows.map((workflow, index) => {
                    const progress = getProgress(workflow);
                    const initials = workflow.employee
                      ? `${workflow.employee.first_name?.[0] || ""}${workflow.employee.last_name?.[0] || ""}`.toUpperCase()
                      : "??";

                    const startDate = new Date(workflow.start_date);
                    const isStartingSoon =
                      !isPast(startDate) && Math.ceil((startDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) <= 7;
                    const hasStarted = isPast(startDate) || isToday(startDate);

                    return (
                      <Card
                        key={workflow.id}
                        className="animate-slide-up opacity-0"
                        style={{ animationDelay: `${350 + index * 100}ms`, animationFillMode: "forwards" }}
                      >
                        <CardContent className="pt-6">
                          <div className="flex items-start gap-4 mb-6">
                            <Avatar className="h-12 w-12">
                              <AvatarFallback className="bg-primary/10 text-primary font-medium">
                                {initials}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <div>
                                  <h3 className="font-semibold">
                                    {workflow.employee?.first_name} {workflow.employee?.last_name}
                                  </h3>
                                  <p className="text-sm text-muted-foreground">
                                    {workflow.employee?.job_title || "Employee"} •{" "}
                                    {workflow.employee?.department || "General"}
                                  </p>
                                  {workflow.employee?.email && (
                                    <p className="text-xs text-muted-foreground mt-0.5">{workflow.employee.email}</p>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      workflow.status === "in-progress" && "border-info text-info bg-info/10",
                                      workflow.status === "pending" && "border-warning text-warning bg-warning/10",
                                      workflow.status === "completed" && "border-success text-success bg-success/10",
                                    )}
                                  >
                                    {workflow.status === "in-progress"
                                      ? "In Progress"
                                      : workflow.status === "completed"
                                        ? "Completed"
                                        : "Pending"}
                                  </Badge>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                        onClick={() => confirmDelete(workflow.id)}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Delete workflow</TooltipContent>
                                  </Tooltip>
                                </div>
                              </div>

                              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3.5 w-3.5" />
                                  Start: {format(startDate, "MMM d, yyyy")}
                                </span>
                                {isStartingSoon && !hasStarted && (
                                  <Badge variant="outline" className="border-info text-info bg-info/10 text-xs">
                                    <Clock className="h-3 w-3 mr-1" />
                                    Starts {formatDistanceToNow(startDate, { addSuffix: true })}
                                  </Badge>
                                )}
                                {hasStarted && workflow.status === "pending" && (
                                  <Badge
                                    variant="outline"
                                    className="border-warning text-warning bg-warning/10 text-xs"
                                  >
                                    <AlertCircle className="h-3 w-3 mr-1" />
                                    Not started yet
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="space-y-3 mb-4">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Onboarding Progress</span>
                              <span className="font-medium">{progress}%</span>
                            </div>
                            <Progress value={progress} className="h-2" />
                          </div>

                          <div className="space-y-2">
                            {workflow.tasks?.map((task) => (
                              <div
                                key={task.id}
                                className={cn(
                                  "flex items-center gap-3 p-3 rounded-lg transition-all cursor-pointer group",
                                  task.is_completed
                                    ? "bg-success/10 text-success"
                                    : "bg-secondary hover:bg-secondary/80",
                                )}
                                onClick={() => toggleTask(task.id, task.is_completed)}
                              >
                                <Checkbox
                                  checked={task.is_completed}
                                  onCheckedChange={() => toggleTask(task.id, task.is_completed)}
                                />
                                <div className="flex-1">
                                  <span className={cn("text-sm", task.is_completed && "line-through")}>
                                    {task.title}
                                  </span>
                                  {task.description && (
                                    <p
                                      className={cn(
                                        "text-xs mt-0.5",
                                        task.is_completed ? "text-success/70" : "text-muted-foreground",
                                      )}
                                    >
                                      {task.description}
                                    </p>
                                  )}
                                </div>
                                {task.is_completed ? (
                                  <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                                ) : (
                                  <Circle className="h-4 w-4 flex-shrink-0 text-muted-foreground group-hover:text-foreground" />
                                )}
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </div>

              <div className="space-y-6">
                <Card
                  className="animate-slide-up opacity-0"
                  style={{ animationDelay: "400ms", animationFillMode: "forwards" }}
                >
                  <CardHeader>
                    <CardTitle className="font-display text-lg">Onboarding Workflow</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {onboardingSteps.map((step, index) => {
                      const Icon = step.icon;
                      return (
                        <div key={step.title} className="flex items-start gap-3">
                          <div className="flex flex-col items-center">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                              <Icon className="h-4 w-4 text-primary" />
                            </div>
                            {index < onboardingSteps.length - 1 && <div className="w-0.5 h-8 bg-border mt-1" />}
                          </div>
                          <div className="pt-1">
                            <p className="font-medium text-sm">{step.title}</p>
                            <p className="text-xs text-muted-foreground">{step.description}</p>
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>

                <Card
                  className="animate-slide-up opacity-0"
                  style={{ animationDelay: "500ms", animationFillMode: "forwards" }}
                >
                  <CardHeader>
                    <CardTitle className="font-display text-lg">Recently Completed</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {completedWorkflows.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">No completed onboardings yet</p>
                    ) : (
                      completedWorkflows.slice(0, 5).map((workflow) => {
                        const initials = workflow.employee
                          ? `${workflow.employee.first_name?.[0] || ""}${workflow.employee.last_name?.[0] || ""}`.toUpperCase()
                          : "??";
                        return (
                          <div key={workflow.id} className="flex items-center gap-3">
                            <Avatar className="h-9 w-9">
                              <AvatarFallback className="bg-success/10 text-success text-sm font-medium">
                                {initials}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">
                                {workflow.employee?.first_name} {workflow.employee?.last_name}
                              </p>
                              <p className="text-xs text-muted-foreground">{workflow.employee?.job_title}</p>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {workflow.completed_at ? format(new Date(workflow.completed_at), "MMM d") : ""}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <h2 className="text-lg font-display font-semibold">Active Offboarding ({activeOffboarding.length})</h2>

              {activeOffboarding.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    <LogOut className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="font-medium">No active offboarding workflows</p>
                    <p className="text-sm mt-1">Start an offboarding when an employee is leaving</p>
                    <Button className="mt-4" variant="outline" onClick={() => setOffboardingDialogOpen(true)}>
                      <UserMinus className="mr-2 h-4 w-4" />
                      Start Offboarding
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                activeOffboarding.map((workflow, index) => {
                  const employee = employees.find((e) => e.id === workflow.employee_id);
                  const initials = employee
                    ? `${employee.first_name?.[0] || ""}${employee.last_name?.[0] || ""}`.toUpperCase()
                    : "??";
                  const checklistItems = [
                    {
                      key: "exit_interview_completed",
                      label: "Exit Interview",
                      description: "Schedule and conduct exit interview",
                      completed: workflow.exit_interview_completed,
                    },
                    {
                      key: "assets_recovered",
                      label: "Assets Recovered",
                      description: "Collect company equipment and badges",
                      completed: workflow.assets_recovered,
                    },
                    {
                      key: "access_revoked",
                      label: "Access Revoked",
                      description: "Disable system access and credentials",
                      completed: workflow.access_revoked,
                    },
                    {
                      key: "final_settlement_processed",
                      label: "Final Settlement",
                      description: "Process final paycheck and benefits",
                      completed: workflow.final_settlement_processed,
                    },
                  ];
                  const progress = getOffboardingProgress(workflow);
                  const lastDay = new Date(workflow.last_working_date);
                  const daysLeft = Math.ceil((lastDay.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

                  return (
                    <Card
                      key={workflow.id}
                      className="animate-slide-up opacity-0"
                      style={{ animationDelay: `${100 + index * 100}ms`, animationFillMode: "forwards" }}
                    >
                      <CardContent className="pt-6">
                        <div className="flex items-start gap-4 mb-6">
                          <Avatar className="h-12 w-12">
                            <AvatarFallback className="bg-destructive/10 text-destructive font-medium">
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <div>
                                <h3 className="font-semibold">
                                  {employee?.first_name} {employee?.last_name}
                                </h3>
                                <p className="text-sm text-muted-foreground">{employee?.job_title || "Employee"}</p>
                              </div>
                              <Badge
                                variant="outline"
                                className={cn(
                                  workflow.status === "completed" && "border-success text-success bg-success/10",
                                  workflow.status === "in-progress" && "border-warning text-warning bg-warning/10",
                                  workflow.status === "pending" && "border-muted-foreground",
                                )}
                              >
                                {workflow.status}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                              <span>Last Day: {format(lastDay, "MMM d, yyyy")}</span>
                              {daysLeft > 0 && (
                                <Badge variant="outline" className="text-xs">
                                  {daysLeft} days left
                                </Badge>
                              )}
                              {daysLeft <= 0 && daysLeft > -7 && (
                                <Badge variant="outline" className="border-destructive text-destructive text-xs">
                                  Past last day
                                </Badge>
                              )}
                            </div>
                            {workflow.reason && (
                              <p className="text-sm text-muted-foreground mt-1">Reason: {workflow.reason}</p>
                            )}
                          </div>
                        </div>

                        <div className="space-y-3 mb-4">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Offboarding Progress</span>
                            <span className="font-medium">{progress}%</span>
                          </div>
                          <Progress value={progress} className="h-2" />
                        </div>

                        <div className="space-y-2">
                          {checklistItems.map((item) => (
                            <div
                              key={item.key}
                              className={cn(
                                "flex items-center gap-3 p-3 rounded-lg transition-all cursor-pointer group",
                                item.completed ? "bg-success/10 text-success" : "bg-secondary hover:bg-secondary/80",
                              )}
                              onClick={() => !item.completed && updateOffboarding(workflow.id, { [item.key]: true })}
                            >
                              <Checkbox checked={item.completed} disabled={item.completed} />
                              <div className="flex-1">
                                <span className={cn("text-sm", item.completed && "line-through")}>{item.label}</span>
                                <p
                                  className={cn(
                                    "text-xs mt-0.5",
                                    item.completed ? "text-success/70" : "text-muted-foreground",
                                  )}
                                >
                                  {item.description}
                                </p>
                              </div>
                              {item.completed ? (
                                <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                              ) : (
                                <Circle className="h-4 w-4 flex-shrink-0 text-muted-foreground group-hover:text-foreground" />
                              )}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="font-display text-lg">Offboarding Checklist</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { icon: FileText, title: "Exit Interview", description: "Schedule and conduct exit interview" },
                  { icon: Laptop, title: "Asset Recovery", description: "Collect company equipment and badges" },
                  { icon: Key, title: "Access Revocation", description: "Disable system access and credentials" },
                  { icon: CheckCircle2, title: "Final Settlement", description: "Process final paycheck and benefits" },
                ].map((step, index) => {
                  const Icon = step.icon;
                  return (
                    <div key={step.title} className="flex items-start gap-3">
                      <div className="flex flex-col items-center">
                        <div className="h-8 w-8 rounded-full bg-destructive/10 flex items-center justify-center">
                          <Icon className="h-4 w-4 text-destructive" />
                        </div>
                        {index < 3 && <div className="w-0.5 h-8 bg-border mt-1" />}
                      </div>
                      <div className="pt-1">
                        <p className="font-medium text-sm">{step.title}</p>
                        <p className="text-xs text-muted-foreground">{step.description}</p>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        )}

        <NewHireDialog open={newHireDialogOpen} onOpenChange={setNewHireDialogOpen} onSubmit={handleNewHire} />

        <Dialog open={offboardingDialogOpen} onOpenChange={setOffboardingDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="font-display text-xl flex items-center gap-2">
                <UserMinus className="h-5 w-5" />
                Start Offboarding
              </DialogTitle>
              <DialogDescription>Initiate the offboarding process for a departing employee.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>
                  Employee <span className="text-destructive">*</span>
                </Label>
                <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees
                      .filter((e) => e.status === "active" || e.status === "probation")
                      .map((emp) => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.first_name} {emp.last_name} - {emp.job_title}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastWorkingDate">
                  Last Working Date <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="lastWorkingDate"
                  type="date"
                  value={lastWorkingDate}
                  onChange={(e) => setLastWorkingDate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="reason">Reason for Leaving</Label>
                <Select value={offboardingReason} onValueChange={setOffboardingReason}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select reason (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="resignation">Resignation</SelectItem>
                    <SelectItem value="termination">Termination</SelectItem>
                    <SelectItem value="retirement">Retirement</SelectItem>
                    <SelectItem value="contract_end">Contract End</SelectItem>
                    <SelectItem value="relocation">Relocation</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button variant="outline" onClick={() => setOffboardingDialogOpen(false)} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button onClick={handleStartOffboarding} disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Starting...
                    </>
                  ) : (
                    "Start Offboarding"
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Onboarding Workflow?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete this onboarding workflow and all associated tasks. This action cannot be
                undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteWorkflow}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </TooltipProvider>
    </DashboardLayout>
  );
};

export default Onboarding;
