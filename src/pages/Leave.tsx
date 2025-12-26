import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Plus, Check, X, ChevronLeft, ChevronRight, Users, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { RequestLeaveDialog } from "@/components/leave/RequestLeaveDialog";
import { useLeaveRequests } from "@/hooks/useLeaveRequests";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";

const Leave = () => {
  const { user, isManager } = useAuth();
  const { requests, balances, loading, createRequest, approveRequest, rejectRequest } = useLeaveRequests();
  const [activeTab, setActiveTab] = useState("all");
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);

  const filteredRequests = requests.filter((req) => {
    if (activeTab === "all") return true;
    return req.status === activeTab;
  });

  const handleApprove = async (id: string) => {
    // Check if user is trying to approve their own request
    const request = requests.find(r => r.id === id);
    if (request?.user_id === user?.id) {
      return; // Can't approve own request - separation of duties
    }
    await approveRequest(id);
  };

  const handleReject = async (id: string) => {
    await rejectRequest(id, "Request denied");
  };

  const handleSubmitRequest = async (request: { type: string; startDate: Date; endDate: Date; reason: string }) => {
    await createRequest({
      leave_type: request.type,
      start_date: request.startDate,
      end_date: request.endDate,
      reason: request.reason,
    });
  };

  // Default balances if none exist
  const displayBalances = balances.length > 0 ? balances.map(b => ({
    type: b.leave_type,
    used: b.used_days,
    total: b.total_days,
    color: b.leave_type === "Annual Leave" ? "bg-primary" : 
           b.leave_type === "Sick Leave" ? "bg-info" : 
           b.leave_type === "Personal Leave" ? "bg-warning" : "bg-success"
  })) : [
    { type: "Annual Leave", used: 0, total: 20, color: "bg-primary" },
    { type: "Sick Leave", used: 0, total: 10, color: "bg-info" },
    { type: "Personal Leave", used: 0, total: 3, color: "bg-warning" },
    { type: "Comp Time", used: 0, total: 5, color: "bg-success" },
  ];

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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 animate-fade-in">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Leave Management</h1>
          <p className="text-muted-foreground mt-1">Manage leave requests and track balances</p>
        </div>
        <Button className="gap-2 shadow-md" onClick={() => setRequestDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Request Leave
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {displayBalances.map((balance, index) => (
          <Card key={balance.type} className="animate-slide-up opacity-0" style={{ animationDelay: `${100 + index * 50}ms`, animationFillMode: "forwards" }}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-medium text-muted-foreground">{balance.type}</p>
                <Badge variant="secondary">{balance.total - balance.used} left</Badge>
              </div>
              <div className="space-y-2">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-display font-bold">{balance.total - balance.used}</span>
                  <span className="text-muted-foreground">/ {balance.total} days</span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div className={cn("h-full rounded-full transition-all duration-500", balance.color)} style={{ width: `${balance.total > 0 ? (balance.used / balance.total) * 100 : 0}%` }} />
                </div>
                <p className="text-xs text-muted-foreground">{balance.used} days used</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
            {filteredRequests.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No leave requests found
              </div>
            ) : (
              filteredRequests.map((request, index) => {
                const initials = "??"; // Would need to join with profiles table
                const isOwnRequest = request.user_id === user?.id;
                
                return (
                  <div 
                    key={request.id} 
                    className="flex items-start gap-4 p-4 rounded-xl bg-accent/30 border border-border hover:border-primary/20 transition-all animate-fade-in" 
                    style={{ animationDelay: `${400 + index * 100}ms` }}
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarImage src="" />
                      <AvatarFallback className="bg-primary/10 text-primary font-medium">{initials}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-medium">
                            {isOwnRequest ? "You" : "Team Member"}
                          </p>
                          <p className="text-sm text-muted-foreground mt-0.5">
                            {request.leave_type} • {format(new Date(request.start_date), "MMM d, yyyy")} - {format(new Date(request.end_date), "MMM d, yyyy")}
                          </p>
                          {request.reason && (
                            <p className="text-sm text-muted-foreground mt-1">"{request.reason}"</p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <Badge variant="outline" className={cn(
                            request.status === "pending" && "border-warning text-warning bg-warning/10",
                            request.status === "approved" && "border-success text-success bg-success/10",
                            request.status === "rejected" && "border-destructive text-destructive bg-destructive/10"
                          )}>{request.status}</Badge>
                          <span className="text-sm font-medium">{request.days} days</span>
                        </div>
                      </div>
                      {request.status === "pending" && isManager && !isOwnRequest && (
                        <div className="flex gap-2 mt-3">
                          <Button size="sm" className="gap-1" onClick={() => handleApprove(request.id)}>
                            <Check className="h-3 w-3" />
                            Approve
                          </Button>
                          <Button size="sm" variant="outline" className="gap-1 text-destructive hover:bg-destructive/10" onClick={() => handleReject(request.id)}>
                            <X className="h-3 w-3" />
                            Reject
                          </Button>
                        </div>
                      )}
                      {request.status === "pending" && isOwnRequest && (
                        <p className="text-xs text-muted-foreground mt-2">Awaiting manager approval</p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card className="animate-slide-up opacity-0" style={{ animationDelay: "400ms", animationFillMode: "forwards" }}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="font-display text-lg flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Team Calendar
              </CardTitle>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7"><ChevronLeft className="h-4 w-4" /></Button>
                <span className="text-sm font-medium px-2">{format(new Date(), "MMM yyyy")}</span>
                <Button variant="ghost" size="icon" className="h-7 w-7"><ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-1 text-center mb-4">
              {["S", "M", "T", "W", "T", "F", "S"].map((day, i) => (
                <div key={i} className="text-xs font-medium text-muted-foreground py-2">{day}</div>
              ))}
              {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => {
                const today = new Date().getDate();
                const hasLeave = requests.some(r => {
                  const start = new Date(r.start_date).getDate();
                  const end = new Date(r.end_date).getDate();
                  return r.status === "approved" && day >= start && day <= end;
                });
                
                return (
                  <div 
                    key={day} 
                    className={cn(
                      "text-sm py-2 rounded-md cursor-pointer transition-colors",
                      day === today && "bg-primary text-primary-foreground font-medium",
                      hasLeave && day !== today && "bg-warning/20 text-warning"
                    )}
                  >
                    {day}
                  </div>
                );
              })}
            </div>
            <div className="space-y-2 pt-4 border-t border-border">
              <p className="text-sm font-medium mb-2">Upcoming Time Off</p>
              <div className="space-y-2">
                {requests
                  .filter(r => r.status === "approved" && new Date(r.start_date) >= new Date())
                  .slice(0, 3)
                  .map(r => (
                    <div key={r.id} className="flex items-center gap-2 text-sm">
                      <div className="h-2 w-2 rounded-full bg-warning" />
                      <span>
                        {format(new Date(r.start_date), "MMM d")} - {format(new Date(r.end_date), "MMM d")}
                      </span>
                    </div>
                  ))}
                {requests.filter(r => r.status === "approved" && new Date(r.start_date) >= new Date()).length === 0 && (
                  <p className="text-sm text-muted-foreground">No upcoming time off</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <RequestLeaveDialog open={requestDialogOpen} onOpenChange={setRequestDialogOpen} onSubmit={handleSubmitRequest} />
    </DashboardLayout>
  );
};

export default Leave;
