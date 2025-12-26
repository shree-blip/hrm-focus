import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle2, Circle, UserPlus, FileText, Mail, Laptop, Key, ArrowRight, LogOut, Loader2, UserMinus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useOnboarding } from "@/hooks/useOnboarding";
import { useEmployees } from "@/hooks/useEmployees";
import { NewHireDialog } from "@/components/onboarding/NewHireDialog";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";

const onboardingSteps = [
  { icon: FileText, title: "Offer Letter", description: "Generate and send offer letter for signature" },
  { icon: CheckCircle2, title: "Background Check", description: "Initiate background verification process" },
  { icon: Key, title: "NDA & Contracts", description: "Collect signed NDA and employment contract" },
  { icon: Laptop, title: "IT Setup", description: "Request equipment and system access" },
  { icon: Mail, title: "Orientation", description: "Schedule onboarding orientation session" },
];

const Onboarding = () => {
  const { workflows, offboardingWorkflows, loading, createOnboarding, completeTask, createOffboarding, updateOffboarding, getProgress } = useOnboarding();
  const { employees } = useEmployees();
  const [activeTab, setActiveTab] = useState<"onboarding" | "offboarding">("onboarding");
  const [newHireDialogOpen, setNewHireDialogOpen] = useState(false);
  const [offboardingDialogOpen, setOffboardingDialogOpen] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [lastWorkingDate, setLastWorkingDate] = useState("");
  const [offboardingReason, setOffboardingReason] = useState("");

  const handleNewHire = async (hire: any) => {
    // Find or create the employee first
    const employee = employees.find(e => 
      `${e.first_name} ${e.last_name}`.toLowerCase() === hire.name.toLowerCase()
    );
    
    if (employee) {
      await createOnboarding(employee.id, new Date(hire.startDate));
    } else {
      toast({
        title: "Employee Not Found",
        description: "Please add the employee first in the Employees page.",
        variant: "destructive",
      });
    }
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

    await createOffboarding(selectedEmployeeId, new Date(lastWorkingDate), offboardingReason);
    setOffboardingDialogOpen(false);
    setSelectedEmployeeId("");
    setLastWorkingDate("");
    setOffboardingReason("");
  };

  const activeWorkflows = workflows.filter(w => w.status !== "completed");
  const recentlyOnboarded = workflows.filter(w => w.status === "completed").slice(0, 3);

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
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 animate-fade-in">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Onboarding</h1>
          <p className="text-muted-foreground mt-1">
            Manage new hire onboarding and offboarding
          </p>
        </div>
        <div className="flex gap-3">
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

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "onboarding" | "offboarding")} className="mb-6">
        <TabsList>
          <TabsTrigger value="onboarding">Onboarding</TabsTrigger>
          <TabsTrigger value="offboarding">Offboarding</TabsTrigger>
        </TabsList>
      </Tabs>

      {activeTab === "onboarding" ? (
        <>
          {/* Onboarding Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
            <Card className="animate-slide-up opacity-0" style={{ animationDelay: "100ms", animationFillMode: "forwards" }}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Pending Onboarding</p>
                    <p className="text-3xl font-display font-bold mt-1">{activeWorkflows.length}</p>
                  </div>
                  <div className="h-12 w-12 rounded-xl bg-warning/10 flex items-center justify-center">
                    <UserPlus className="h-6 w-6 text-warning" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="animate-slide-up opacity-0" style={{ animationDelay: "150ms", animationFillMode: "forwards" }}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Completed This Month</p>
                    <p className="text-3xl font-display font-bold mt-1">{recentlyOnboarded.length}</p>
                  </div>
                  <div className="h-12 w-12 rounded-xl bg-success/10 flex items-center justify-center">
                    <CheckCircle2 className="h-6 w-6 text-success" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="animate-slide-up opacity-0" style={{ animationDelay: "200ms", animationFillMode: "forwards" }}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Avg. Completion Time</p>
                    <p className="text-3xl font-display font-bold mt-1">5 days</p>
                  </div>
                  <div className="h-12 w-12 rounded-xl bg-info/10 flex items-center justify-center">
                    <FileText className="h-6 w-6 text-info" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Active Onboarding */}
            <div className="lg:col-span-2 space-y-6">
              <h2 className="text-lg font-display font-semibold animate-fade-in" style={{ animationDelay: "250ms" }}>
                Active Onboarding
              </h2>
              {activeWorkflows.length === 0 ? (
                <Card className="animate-slide-up opacity-0" style={{ animationDelay: "300ms", animationFillMode: "forwards" }}>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    <UserPlus className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No active onboarding workflows</p>
                    <Button className="mt-4" onClick={() => setNewHireDialogOpen(true)}>
                      Start New Onboarding
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                activeWorkflows.map((workflow, index) => {
                  const progress = getProgress(workflow);
                  const initials = workflow.employee 
                    ? `${workflow.employee.first_name?.[0] || ""}${workflow.employee.last_name?.[0] || ""}`.toUpperCase()
                    : "??";
                    
                  return (
                    <Card
                      key={workflow.id}
                      className="animate-slide-up opacity-0"
                      style={{ animationDelay: `${300 + index * 100}ms`, animationFillMode: "forwards" }}
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
                                  {workflow.employee?.job_title || "Employee"} • {workflow.employee?.department || "General"}
                                </p>
                              </div>
                              <Badge
                                variant="outline"
                                className={cn(
                                  workflow.status === "in-progress" && "border-info text-info bg-info/10",
                                  workflow.status === "pending" && "border-warning text-warning bg-warning/10"
                                )}
                              >
                                {workflow.status === "in-progress" ? "In Progress" : "Pending"}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              Start Date: {format(new Date(workflow.start_date), "MMM d, yyyy")}
                            </p>
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
                                "flex items-center gap-3 p-3 rounded-lg transition-all cursor-pointer",
                                task.is_completed
                                  ? "bg-success/10 text-success"
                                  : "bg-secondary hover:bg-secondary/80"
                              )}
                              onClick={() => !task.is_completed && completeTask(task.id)}
                            >
                              <Checkbox 
                                checked={task.is_completed} 
                                onCheckedChange={() => !task.is_completed && completeTask(task.id)}
                              />
                              <span className={cn("text-sm", task.is_completed && "line-through")}>{task.title}</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Onboarding Workflow */}
              <Card className="animate-slide-up opacity-0" style={{ animationDelay: "400ms", animationFillMode: "forwards" }}>
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
                          {index < onboardingSteps.length - 1 && (
                            <div className="w-0.5 h-8 bg-border mt-1" />
                          )}
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

              {/* Recently Onboarded */}
              <Card className="animate-slide-up opacity-0" style={{ animationDelay: "500ms", animationFillMode: "forwards" }}>
                <CardHeader>
                  <CardTitle className="font-display text-lg">Recently Onboarded</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {recentlyOnboarded.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No completed onboardings yet</p>
                  ) : (
                    recentlyOnboarded.map((workflow) => {
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
        /* Offboarding Tab */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <h2 className="text-lg font-display font-semibold">Active Offboarding</h2>
            {offboardingWorkflows.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <LogOut className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No active offboarding workflows</p>
                  <Button className="mt-4" variant="outline" onClick={() => setOffboardingDialogOpen(true)}>
                    Start Offboarding
                  </Button>
                </CardContent>
              </Card>
            ) : (
              offboardingWorkflows.map((workflow, index) => {
                const employee = employees.find(e => e.id === workflow.employee_id);
                const initials = employee 
                  ? `${employee.first_name?.[0] || ""}${employee.last_name?.[0] || ""}`.toUpperCase()
                  : "??";
                const checklistItems = [
                  { key: "exit_interview_completed", label: "Exit Interview", completed: workflow.exit_interview_completed },
                  { key: "assets_recovered", label: "Assets Recovered", completed: workflow.assets_recovered },
                  { key: "access_revoked", label: "Access Revoked", completed: workflow.access_revoked },
                  { key: "final_settlement_processed", label: "Final Settlement", completed: workflow.final_settlement_processed },
                ];
                const progress = (checklistItems.filter(i => i.completed).length / checklistItems.length) * 100;

                return (
                  <Card key={workflow.id} className="animate-slide-up opacity-0" style={{ animationDelay: `${100 + index * 100}ms`, animationFillMode: "forwards" }}>
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
                              <h3 className="font-semibold">{employee?.first_name} {employee?.last_name}</h3>
                              <p className="text-sm text-muted-foreground">{employee?.job_title || "Employee"}</p>
                            </div>
                            <Badge variant="outline" className={cn(
                              workflow.status === "completed" && "border-success text-success",
                              workflow.status === "in-progress" && "border-warning text-warning",
                              workflow.status === "pending" && "border-muted-foreground"
                            )}>
                              {workflow.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            Last Day: {format(new Date(workflow.last_working_date), "MMM d, yyyy")}
                          </p>
                          {workflow.reason && (
                            <p className="text-sm text-muted-foreground">Reason: {workflow.reason}</p>
                          )}
                        </div>
                      </div>

                      <div className="space-y-3 mb-4">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Offboarding Progress</span>
                          <span className="font-medium">{Math.round(progress)}%</span>
                        </div>
                        <Progress value={progress} className="h-2" />
                      </div>

                      <div className="space-y-2">
                        {checklistItems.map((item) => (
                          <div
                            key={item.key}
                            className={cn(
                              "flex items-center gap-3 p-3 rounded-lg transition-all cursor-pointer",
                              item.completed
                                ? "bg-success/10 text-success"
                                : "bg-secondary hover:bg-secondary/80"
                            )}
                            onClick={() => !item.completed && updateOffboarding(workflow.id, { [item.key]: true })}
                          >
                            <Checkbox checked={item.completed} />
                            <span className={cn("text-sm", item.completed && "line-through")}>{item.label}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>

          {/* Offboarding Checklist */}
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

      {/* New Hire Dialog */}
      <NewHireDialog 
        open={newHireDialogOpen} 
        onOpenChange={setNewHireDialogOpen} 
        onSubmit={handleNewHire} 
      />

      {/* Offboarding Dialog */}
      <Dialog open={offboardingDialogOpen} onOpenChange={setOffboardingDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Start Offboarding</DialogTitle>
            <DialogDescription>
              Initiate the offboarding process for an employee.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Employee</Label>
              <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.filter(e => e.status === "active").map(emp => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.first_name} {emp.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastWorkingDate">Last Working Date</Label>
              <Input
                id="lastWorkingDate"
                type="date"
                value={lastWorkingDate}
                onChange={(e) => setLastWorkingDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">Reason (Optional)</Label>
              <Textarea
                id="reason"
                placeholder="Enter reason for leaving..."
                value={offboardingReason}
                onChange={(e) => setOffboardingReason(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setOffboardingDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleStartOffboarding}>
                Start Offboarding
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Onboarding;
