import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Plus, Check, X, ChevronLeft, ChevronRight, Clock, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const leaveRequests = [
  {
    id: 1,
    name: "Sarah Johnson",
    initials: "SJ",
    type: "Annual Leave",
    startDate: "Dec 27, 2025",
    endDate: "Dec 29, 2025",
    days: 3,
    status: "pending",
    reason: "Family vacation during the holidays",
  },
  {
    id: 2,
    name: "Michael Chen",
    initials: "MC",
    type: "Sick Leave",
    startDate: "Dec 26, 2025",
    endDate: "Dec 26, 2025",
    days: 1,
    status: "pending",
    reason: "Not feeling well",
  },
  {
    id: 3,
    name: "Emily Davis",
    initials: "ED",
    type: "Personal Leave",
    startDate: "Jan 2, 2026",
    endDate: "Jan 3, 2026",
    days: 2,
    status: "approved",
    reason: "Personal errands",
  },
  {
    id: 4,
    name: "James Wilson",
    initials: "JW",
    type: "Annual Leave",
    startDate: "Dec 23, 2025",
    endDate: "Dec 24, 2025",
    days: 2,
    status: "rejected",
    reason: "Year-end closing period",
  },
];

const leaveBalances = [
  { type: "Annual Leave", used: 8, total: 20, color: "bg-primary" },
  { type: "Sick Leave", used: 2, total: 10, color: "bg-info" },
  { type: "Personal Leave", used: 1, total: 3, color: "bg-warning" },
  { type: "Comp Time", used: 0, total: 5, color: "bg-success" },
];

const Leave = () => {
  const [activeTab, setActiveTab] = useState("all");

  const filteredRequests = leaveRequests.filter((req) => {
    if (activeTab === "all") return true;
    return req.status === activeTab;
  });

  return (
    <DashboardLayout>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 animate-fade-in">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Leave Management</h1>
          <p className="text-muted-foreground mt-1">
            Manage leave requests and track balances
          </p>
        </div>
        <Button className="gap-2 shadow-md">
          <Plus className="h-4 w-4" />
          Request Leave
        </Button>
      </div>

      {/* Leave Balance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {leaveBalances.map((balance, index) => (
          <Card
            key={balance.type}
            className="animate-slide-up opacity-0"
            style={{ animationDelay: `${100 + index * 50}ms`, animationFillMode: "forwards" }}
          >
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-medium text-muted-foreground">{balance.type}</p>
                <Badge variant="secondary">
                  {balance.total - balance.used} left
                </Badge>
              </div>
              <div className="space-y-2">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-display font-bold">{balance.total - balance.used}</span>
                  <span className="text-muted-foreground">/ {balance.total} days</span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all duration-500", balance.color)}
                    style={{ width: `${(balance.used / balance.total) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">{balance.used} days used</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Leave Requests */}
        <Card className="lg:col-span-2 animate-slide-up opacity-0" style={{ animationDelay: "300ms", animationFillMode: "forwards" }}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="font-display text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Leave Requests
              </CardTitle>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="pending">Pending</TabsTrigger>
                  <TabsTrigger value="approved">Approved</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {filteredRequests.map((request, index) => (
              <div
                key={request.id}
                className="flex items-start gap-4 p-4 rounded-xl bg-accent/30 border border-border hover:border-primary/20 transition-all animate-fade-in"
                style={{ animationDelay: `${400 + index * 100}ms` }}
              >
                <Avatar className="h-10 w-10">
                  <AvatarImage src="" />
                  <AvatarFallback className="bg-primary/10 text-primary font-medium">
                    {request.initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium">{request.name}</p>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {request.type} • {request.startDate} - {request.endDate}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        "{request.reason}"
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge
                        variant="outline"
                        className={cn(
                          request.status === "pending" && "border-warning text-warning bg-warning/10",
                          request.status === "approved" && "border-success text-success bg-success/10",
                          request.status === "rejected" && "border-destructive text-destructive bg-destructive/10"
                        )}
                      >
                        {request.status}
                      </Badge>
                      <span className="text-sm font-medium">{request.days} days</span>
                    </div>
                  </div>
                  {request.status === "pending" && (
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" className="gap-1">
                        <Check className="h-3 w-3" />
                        Approve
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1 text-destructive hover:bg-destructive/10">
                        <X className="h-3 w-3" />
                        Reject
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Team Calendar */}
        <Card className="animate-slide-up opacity-0" style={{ animationDelay: "400ms", animationFillMode: "forwards" }}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="font-display text-lg flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Team Calendar
              </CardTitle>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium px-2">Dec 2025</span>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Mini Calendar Grid */}
            <div className="grid grid-cols-7 gap-1 text-center mb-4">
              {["S", "M", "T", "W", "T", "F", "S"].map((day, i) => (
                <div key={i} className="text-xs font-medium text-muted-foreground py-2">
                  {day}
                </div>
              ))}
              {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                <div
                  key={day}
                  className={cn(
                    "text-sm py-2 rounded-md cursor-pointer transition-colors",
                    day === 26 && "bg-primary text-primary-foreground font-medium",
                    (day === 27 || day === 28 || day === 29) && "bg-warning/20 text-warning",
                    day === 25 && "bg-muted text-muted-foreground"
                  )}
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="space-y-2 pt-4 border-t border-border">
              <p className="text-sm font-medium mb-2">Who's Out</p>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <div className="h-2 w-2 rounded-full bg-warning" />
                  <span>Sarah J. - Dec 27-29</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="h-2 w-2 rounded-full bg-info" />
                  <span>Michael C. - Dec 26</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Leave;
