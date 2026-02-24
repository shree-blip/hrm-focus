import { Calendar, ArrowRight, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { useLeaveRequests } from "@/hooks/useLeaveRequests";
import { useAuth } from "@/contexts/AuthContext";
import { format, parseISO } from "date-fns";

export function LeaveWidget() {
  const { requests, ownRequests, loading } = useLeaveRequests();
  const { user, isManager } = useAuth();

  // Get the first 3 pending requests for managers, or user's own requests for employees
  const todayStr = new Date().toISOString().split("T")[0];

  const displayRequests = (isManager ? requests : ownRequests)
    .filter((r) => {
      if (r.status === "pending") return true;
      if (r.status === "approved" && r.end_date >= todayStr) return true;
      return false;
    })
    .slice(0, 3);

  // Calculate business days between two dates (excluding weekends)
  const getBusinessDaysBetween = (startDate: Date, endDate: Date): number => {
    let count = 0;
    const current = new Date(startDate);

    while (current <= endDate) {
      const dayOfWeek = current.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        count++;
      }
      current.setDate(current.getDate() + 1);
    }

    return count;
  };

  // Calculate consecutive working days without leave
  const calculateDaysWithoutLeave = (): number => {
    if (!user || !ownRequests || ownRequests.length === 0) return 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get user's approved leave requests sorted by end_date descending
    const approvedLeaves = ownRequests
      .filter((r) => r.status === "approved" && r.user_id === user.id)
      .sort((a, b) => new Date(b.end_date).getTime() - new Date(a.end_date).getTime());

    if (approvedLeaves.length === 0) {
      // No approved leave found - return 0 to not show warning for new employees
      return 0;
    }

    // Find the most recent leave that has ended
    const lastCompletedLeave = approvedLeaves.find((leave) => {
      const endDate = new Date(leave.end_date);
      endDate.setHours(0, 0, 0, 0);
      return endDate < today;
    });

    if (!lastCompletedLeave) {
      // All leaves are in the future or ongoing
      return 0;
    }

    // Calculate business days since last leave ended
    const lastLeaveEnd = new Date(lastCompletedLeave.end_date);
    lastLeaveEnd.setHours(0, 0, 0, 0);

    // Start counting from the day after leave ended
    const startCounting = new Date(lastLeaveEnd);
    startCounting.setDate(startCounting.getDate() + 1);

    return getBusinessDaysBetween(startCounting, today);
  };

  const daysWithoutLeave = calculateDaysWithoutLeave();
  const showLeaveWarning = daysWithoutLeave >= 15; // Show warning when approaching 21 days
  const isUrgent = daysWithoutLeave >= 18; // More urgent when very close

  const formatDateRange = (startDate: string, endDate: string) => {
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    if (startDate === endDate) {
      return format(start, "MMM d");
    }
    return `${format(start, "MMM d")} - ${format(end, "MMM d")}`;
  };

  const getEmployeeName = (request: any) => {
    if (request.profile?.first_name || request.profile?.last_name) {
      return `${request.profile.first_name || ""} ${request.profile.last_name || ""}`.trim();
    }
    return "Unknown";
  };

  const getInitials = (request: any) => {
    if (request.profile?.first_name && request.profile?.last_name) {
      return `${request.profile.first_name[0]}${request.profile.last_name[0]}`.toUpperCase();
    }
    if (request.profile?.first_name) {
      return request.profile.first_name.substring(0, 2).toUpperCase();
    }
    return "U";
  };

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-md font-medium flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          {isManager ? "Leave Requests" : "My Leave"}
        </CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/leave" className="flex items-center gap-1 text-xs">
            View All
            <ArrowRight className="h-3 w-3" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="text-center py-4 text-muted-foreground">Loading...</div>
        ) : displayRequests.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground">
            {isManager ? "No pending leave requests" : "No leave requests"}
          </div>
        ) : (
          displayRequests.map((request) => (
            <div
              key={request.id}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
            >
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs bg-primary/10 text-primary">{getInitials(request)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{getEmployeeName(request)}</p>
                <p className="text-xs text-muted-foreground">
                  {request.leave_type} • {formatDateRange(request.start_date, request.end_date)}
                </p>
              </div>
              <Badge
                variant={request.status === "pending" ? "outline" : "secondary"}
                className={
                  request.status === "pending"
                    ? "border-warning text-warning"
                    : request.status === "approved"
                      ? "bg-success/10 text-success"
                      : "bg-destructive/10 text-destructive"
                }
              >
                {request.status === "pending"
                  ? `${request.days} ${request.days === 1 ? "day" : "days"}`
                  : request.status}
              </Badge>
            </div>
          ))
        )}

        {/* Leave Warning Banner - Show when approaching 21 days without leave */}
        {!loading && showLeaveWarning && (
          <div
            className={`mt-4 p-3 rounded-lg border ${
              isUrgent ? "bg-destructive/10 border-destructive/30" : "bg-warning/10 border-warning/30"
            }`}
          >
            <div className="flex items-start gap-2">
              <AlertTriangle
                className={`h-4 w-4 mt-0.5 flex-shrink-0 ${isUrgent ? "text-destructive" : "text-warning"}`}
              />
              <div className="flex-1">
                <p className={`text-sm font-medium ${isUrgent ? "text-destructive" : "text-warning"}`}>
                  {isUrgent ? "Time to take a break!" : "Consider taking some time off"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  You've been working for {daysWithoutLeave} business days without leave.
                  {daysWithoutLeave >= 21
                    ? " It's important to rest and recharge."
                    : ` Only ${21 - daysWithoutLeave} days until the 21-day mark.`}
                </p>
                <Button
                  variant="link"
                  size="sm"
                  asChild
                  className={`p-0 h-auto mt-1 ${isUrgent ? "text-destructive" : "text-warning"}`}
                >
                  <Link to="/leave">Request Leave →</Link>
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
