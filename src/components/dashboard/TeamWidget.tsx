import { Users, ArrowRight, Circle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { useEmployees } from "@/hooks/useEmployees";
import { useAuth } from "@/contexts/AuthContext";
import { useTeamPresence } from "@/hooks/useTeamPresence";

export function TeamWidget() {
  const { employees, loading } = useEmployees();
  const { isManager, profile } = useAuth();
  const { getStatus, getOnlineCount } = useTeamPresence();

  // For regular employees, show their own info; for managers, show team
  const displayMembers = employees.slice(0, 5);

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
  };

  const onlineCount = getOnlineCount();

  return (
    <Card className="animate-slide-up opacity-0" style={{ animationDelay: "500ms", animationFillMode: "forwards" }}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            {isManager ? "Team Status" : "My Profile"}
          </CardTitle>
          <Link to="/employees">
            <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80 gap-1">
              View All
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
        {isManager && (
          <p className="text-sm text-muted-foreground">
            <span className="text-success font-medium">{onlineCount}</span> of {displayMembers.length} online
          </p>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-4 text-muted-foreground text-sm">Loading...</div>
        ) : !isManager ? (
          // Show only current user's profile for regular employees
          <div className="flex items-center gap-3 p-2 rounded-lg bg-accent/30">
            <div className="relative">
              <Avatar className="h-12 w-12">
                <AvatarImage src="" />
                <AvatarFallback className="bg-primary/10 text-primary font-medium">
                  {profile ? getInitials(profile.first_name, profile.last_name) : "U"}
                </AvatarFallback>
              </Avatar>
              <Circle className="absolute -bottom-0.5 -right-0.5 h-3 w-3 fill-current stroke-card stroke-2 text-success" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">
                {profile ? `${profile.first_name} ${profile.last_name}` : "Loading..."}
              </p>
              <p className="text-xs text-muted-foreground">{profile?.job_title || "Employee"}</p>
              <p className="text-xs text-muted-foreground">{profile?.department || ""}</p>
            </div>
          </div>
        ) : (
          // Show team members for managers
          <div className="space-y-3">
            {displayMembers.map((member) => {
              const status = getStatus(member.id);
              return (
                <div
                  key={member.id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50 transition-colors cursor-pointer"
                >
                  <div className="relative">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src="" />
                      <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                        {getInitials(member.first_name, member.last_name)}
                      </AvatarFallback>
                    </Avatar>
                    <Circle
                      className={cn(
                        "absolute -bottom-0.5 -right-0.5 h-3 w-3 fill-current stroke-card stroke-2",
                        status === "online" && "text-success",
                        status === "break" && "text-warning",
                        status === "offline" && "text-muted-foreground"
                      )}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {member.first_name} {member.last_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {member.job_title || "Employee"}
                      {status === "online" && <span className="ml-2 text-success">• Working</span>}
                      {status === "break" && <span className="ml-2 text-warning">• On Break</span>}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
