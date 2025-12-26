import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle, UserPlus, FileText, Mail, Laptop, Key, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

const newHires = [
  {
    id: 1,
    name: "Alex Thompson",
    initials: "AT",
    role: "Staff Accountant",
    department: "Bookkeeping",
    startDate: "Jan 6, 2026",
    progress: 40,
    status: "in-progress",
    tasks: [
      { name: "Send Offer Letter", completed: true },
      { name: "Background Check", completed: true },
      { name: "Sign NDA", completed: false },
      { name: "IT Setup Request", completed: false },
      { name: "Schedule Orientation", completed: false },
    ],
  },
  {
    id: 2,
    name: "Jessica Lee",
    initials: "JL",
    role: "Tax Associate",
    department: "Tax",
    startDate: "Jan 13, 2026",
    progress: 20,
    status: "pending",
    tasks: [
      { name: "Send Offer Letter", completed: true },
      { name: "Background Check", completed: false },
      { name: "Sign NDA", completed: false },
      { name: "IT Setup Request", completed: false },
      { name: "Schedule Orientation", completed: false },
    ],
  },
];

const onboardingSteps = [
  { icon: FileText, title: "Offer Letter", description: "Generate and send offer letter for signature" },
  { icon: CheckCircle2, title: "Background Check", description: "Initiate background verification process" },
  { icon: Key, title: "NDA & Contracts", description: "Collect signed NDA and employment contract" },
  { icon: Laptop, title: "IT Setup", description: "Request equipment and system access" },
  { icon: Mail, title: "Orientation", description: "Schedule onboarding orientation session" },
];

const recentlyOnboarded = [
  { name: "Michael Chen", initials: "MC", role: "Tax Associate", date: "Dec 15, 2025" },
  { name: "Priya Patel", initials: "PP", role: "Associate", date: "Dec 1, 2025" },
  { name: "David Kim", initials: "DK", role: "Operations Coordinator", date: "Nov 20, 2025" },
];

const Onboarding = () => {
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
        <Button className="gap-2 shadow-md">
          <UserPlus className="h-4 w-4" />
          New Hire
        </Button>
      </div>

      {/* Onboarding Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
        <Card className="animate-slide-up opacity-0" style={{ animationDelay: "100ms", animationFillMode: "forwards" }}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Onboarding</p>
                <p className="text-3xl font-display font-bold mt-1">2</p>
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
                <p className="text-sm text-muted-foreground">This Month</p>
                <p className="text-3xl font-display font-bold mt-1">3</p>
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
          {newHires.map((hire, index) => (
            <Card
              key={hire.id}
              className="animate-slide-up opacity-0"
              style={{ animationDelay: `${300 + index * 100}ms`, animationFillMode: "forwards" }}
            >
              <CardContent className="pt-6">
                <div className="flex items-start gap-4 mb-6">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-primary/10 text-primary font-medium">
                      {hire.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold">{hire.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {hire.role} • {hire.department}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          hire.status === "in-progress" && "border-info text-info bg-info/10",
                          hire.status === "pending" && "border-warning text-warning bg-warning/10"
                        )}
                      >
                        {hire.status === "in-progress" ? "In Progress" : "Pending"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Start Date: {hire.startDate}
                    </p>
                  </div>
                </div>

                <div className="space-y-3 mb-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Onboarding Progress</span>
                    <span className="font-medium">{hire.progress}%</span>
                  </div>
                  <Progress value={hire.progress} className="h-2" />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {hire.tasks.map((task, taskIndex) => (
                    <div
                      key={task.name}
                      className={cn(
                        "flex items-center gap-2 p-2 rounded-lg text-xs transition-all",
                        task.completed
                          ? "bg-success/10 text-success"
                          : "bg-secondary text-muted-foreground"
                      )}
                    >
                      {task.completed ? (
                        <CheckCircle2 className="h-3 w-3 shrink-0" />
                      ) : (
                        <Circle className="h-3 w-3 shrink-0" />
                      )}
                      <span className="truncate">{task.name}</span>
                    </div>
                  ))}
                </div>

                <Button variant="outline" className="w-full mt-4 gap-2">
                  Continue Onboarding
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
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
              {recentlyOnboarded.map((person) => (
                <div key={person.name} className="flex items-center gap-3">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="bg-success/10 text-success text-sm font-medium">
                      {person.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{person.name}</p>
                    <p className="text-xs text-muted-foreground">{person.role}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{person.date}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Onboarding;
