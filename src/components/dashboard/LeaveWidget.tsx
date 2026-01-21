import { Calendar, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { useLeaveRequests } from "@/hooks/useLeaveRequests";
import { useAuth } from "@/contexts/AuthContext";
import { format, parseISO } from "date-fns";

export function LeaveWidget() {
  const { requests, balances, loading } = useLeaveRequests();
  const { isManager } = useAuth();

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
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Calendar className="h-5 w-5 text-blue-600" />
          {isManager ? "Leave Requests" : "My Leave"}
        </CardTitle>
        <Link to="/leave">
          <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700">
            View All
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </Link>
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
            <div key={request.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-blue-100 text-blue-700 text-sm font-medium">
                  {getInitials(request)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{getEmployeeName(request)}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{request.leave_type}</span>
                  <span>•</span>
                  <span>{formatDateRange(request.start_date, request.end_date)}</span>
                </div>
              </div>
              <Badge
                variant={
                  request.status === "approved"
                    ? "default"
                    : request.status === "rejected"
                      ? "destructive"
                      : "secondary"
                }
                className="shrink-0"
              >
                {request.status === "pending"
                  ? `${request.days} ${request.days === 1 ? "day" : "days"}`
                  : request.status}
              </Badge>
            </div>
          ))
        )}

        {/* Leave Balance Summary - only show for the current user */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{annualLeft}</div>
            <div className="text-xs text-muted-foreground">Annual Left</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">{sickLeft}</div>
            <div className="text-xs text-muted-foreground">Sick Left</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">{personalLeft}</div>
            <div className="text-xs text-muted-foreground">Personal Left</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
