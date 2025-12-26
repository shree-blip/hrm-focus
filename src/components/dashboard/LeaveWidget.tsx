import { Calendar, Clock, Check, X, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";

const leaveRequests = [
  {
    id: 1,
    name: "Sarah Johnson",
    avatar: "",
    initials: "SJ",
    type: "Annual Leave",
    dates: "Dec 27 - Dec 29",
    days: 3,
    status: "pending",
  },
  {
    id: 2,
    name: "Michael Chen",
    avatar: "",
    initials: "MC",
    type: "Sick Leave",
    dates: "Dec 26",
    days: 1,
    status: "pending",
  },
];

export function LeaveWidget() {
  return (
    <Card className="animate-slide-up opacity-0" style={{ animationDelay: "400ms", animationFillMode: "forwards" }}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Leave Requests
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
        {leaveRequests.map((request) => (
          <div
            key={request.id}
            className="flex items-center gap-4 p-3 rounded-lg bg-accent/30 border border-border"
          >
            <Avatar className="h-10 w-10">
              <AvatarImage src={request.avatar} />
              <AvatarFallback className="bg-primary/10 text-primary font-medium">
                {request.initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">{request.name}</p>
              <p className="text-xs text-muted-foreground">
                {request.type} • {request.dates}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                {request.days} {request.days === 1 ? "day" : "days"}
              </Badge>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" className="h-8 w-8 text-success hover:text-success hover:bg-success/10">
                  <Check className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}

        {/* Leave Balance Summary */}
        <div className="grid grid-cols-3 gap-3 pt-2 border-t border-border">
          <div className="text-center">
            <p className="text-lg font-semibold text-foreground">12</p>
            <p className="text-xs text-muted-foreground">Annual Left</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold text-foreground">5</p>
            <p className="text-xs text-muted-foreground">Sick Left</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold text-foreground">2</p>
            <p className="text-xs text-muted-foreground">Personal Left</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
