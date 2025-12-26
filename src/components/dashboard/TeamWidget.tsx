import { Users, ArrowRight, Circle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

const teamMembers = [
  { id: 1, name: "Sarah Johnson", role: "Staff Accountant", status: "online", initials: "SJ" },
  { id: 2, name: "Michael Chen", role: "Tax Associate", status: "online", initials: "MC" },
  { id: 3, name: "Emily Davis", role: "Bookkeeper", status: "away", initials: "ED" },
  { id: 4, name: "James Wilson", role: "Intern", status: "offline", initials: "JW" },
  { id: 5, name: "Lisa Park", role: "Senior Accountant", status: "online", initials: "LP" },
];

export function TeamWidget() {
  const onlineCount = teamMembers.filter((m) => m.status === "online").length;

  return (
    <Card className="animate-slide-up opacity-0" style={{ animationDelay: "500ms", animationFillMode: "forwards" }}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Team Status
          </CardTitle>
          <Link to="/employees">
            <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80 gap-1">
              View All
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
        <p className="text-sm text-muted-foreground">
          <span className="text-success font-medium">{onlineCount}</span> of {teamMembers.length} online
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {teamMembers.map((member) => (
            <div
              key={member.id}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50 transition-colors cursor-pointer"
            >
              <div className="relative">
                <Avatar className="h-9 w-9">
                  <AvatarImage src="" />
                  <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                    {member.initials}
                  </AvatarFallback>
                </Avatar>
                <Circle
                  className={cn(
                    "absolute -bottom-0.5 -right-0.5 h-3 w-3 fill-current stroke-card stroke-2",
                    member.status === "online" && "text-success",
                    member.status === "away" && "text-warning",
                    member.status === "offline" && "text-muted-foreground"
                  )}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{member.name}</p>
                <p className="text-xs text-muted-foreground">{member.role}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
