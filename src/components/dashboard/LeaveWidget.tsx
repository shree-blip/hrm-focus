import { Calendar, Check, X, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { useLeaveRequests } from "@/hooks/useLeaveRequests";
import { useAuth } from "@/contexts/AuthContext";
import { format, parseISO } from "date-fns";

export function LeaveWidget() {
  const { requests, balances, approveRequest, rejectRequest, loading } = useLeaveRequests();
  const { isManager, profile } = useAuth();

  // Get the first 3 pending requests for managers, or user's own requests for employees
  const displayRequests = requests.slice(0, 3);

  // Calculate leave balances
  const annualBalance = balances.find((b) => b.leave_type === "Annual Leave");
  const sickBalance = balances.find((b) => b.leave_type === "Sick Leave");
  const personalBalance = balances.find((b) => b.leave_type === "Personal Leave");

  const annualLeft = annualBalance ? annualBalance.total_days - annualBalance.used_days : 0;
  const sickLeft = sickBalance ? sickBalance.total_days - sickBalance.used_days : 0;
  const personalLeft = personalBalance ? personalBalance.total_days - personalBalance.used_days : 0;

  const formatDateRange = (startDate: string, endDate: string) => {
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    if (startDate === endDate) {
      return format(start, "MMM d");
    }
    return `${format(start, "MMM d")} - ${format(end, "MMM d")}`;
  };

  const getInitials = (userId: string) => {
    // For now, use first two letters of user id or a default
    return "U";
  };

  return (
    <Card className="animate-slide-up opacity-0" style={{ animationDelay: "400ms", animationFillMode: "forwards" }}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            {isManager ? "Leave Requests" : "My Leave"}
          </CardTitle>
          <Link to="/leave">
            <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80 gap-1">
              View All
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="text-center py-4 text-muted-foreground text-sm">Loading...</div>
        ) : displayRequests.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground text-sm">
            {isManager ? "No pending leave requests" : "No leave requests"}
          </div>
        ) : (
          displayRequests.map((request) => (
            <div key={request.id} className="flex items-center gap-4 p-3 rounded-lg bg-accent/30 border border-border">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-primary/10 text-primary font-medium">
                  {getInitials(request.user_id)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{request.leave_type}</p>
                <p className="text-xs text-muted-foreground">{formatDateRange(request.start_date, request.end_date)}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant={
                    request.status === "approved"
                      ? "default"
                      : request.status === "rejected"
                        ? "destructive"
                        : "secondary"
                  }
                  className="text-xs"
                >
                  {request.status === "pending"
                    ? `${request.days} ${request.days === 1 ? "day" : "days"}`
                    : request.status}
                </Badge>
                {isManager && request.status === "pending" && (
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-success hover:text-success hover:bg-success/10"
                      onClick={() => approveRequest(request.id)}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => rejectRequest(request.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}

        {/* Leave Balance Summary - only show for the current user */}
        <div className="grid grid-cols-3 gap-3 pt-2 border-t border-border">
          <div className="text-center">
            <p className="text-lg font-semibold text-foreground">{annualLeft}</p>
            <p className="text-xs text-muted-foreground">Annual Left</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold text-foreground">{sickLeft}</p>
            <p className="text-xs text-muted-foreground">Sick Left</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold text-foreground">{personalLeft}</p>
            <p className="text-xs text-muted-foreground">Personal Left</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
