import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Users, Clock, Mail, UserPlus, UserMinus, CheckCircle2, AlertCircle, X, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { TeamMemberAttendanceDialog } from "./TeamMemberAttendanceDialog";
import { AddToTeamDialog } from "./AddToTeamDialog";
import { toast } from "@/hooks/use-toast";
import { RequestPromotionDialog } from "./RequestPromotionDialog";

interface TeamMember {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  department: string | null;
  job_title: string | null;
  location: string | null;
  status: string | null;
  hire_date: string | null;
}

export function MyTeamSection() {
  const { user, role, profile, isVP, isAdmin, isManager, isLineManager, isSupervisor } = useAuth();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [promotionMember, setPromotionMember] = useState<TeamMember | null>(null);
  const [promotionOpen, setPromotionOpen] = useState(false);
  const [attendanceDialogOpen, setAttendanceDialogOpen] = useState(false);
  const [addToTeamOpen, setAddToTeamOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const badgeText = `${profile?.job_title || ""} ${role || ""}`.toLowerCase();
  const hasBadgeRoleAccess =
    badgeText.includes("line manager") ||
    badgeText.includes("manager") ||
    badgeText.includes("supervisor") ||
    badgeText.includes("admin") ||
    badgeText.includes("vp") ||
    badgeText.includes("ceo");
  const canRequestPromotion = isVP || isAdmin || isManager || isLineManager || isSupervisor || hasBadgeRoleAccess;

  const fetchTeamMembers = useCallback(async () => {
    if (!user) return;

    const { data: employeeId } = await supabase.rpc('get_employee_id_for_user', {
      _user_id: user.id
    });

    if (employeeId) {
      // Query from team_members junction table
      const { data: teamRows } = await supabase
        .from("team_members")
        .select("member_employee_id")
        .eq("manager_employee_id", employeeId);

      const memberIds = (teamRows || []).map((r: any) => r.member_employee_id);

      if (memberIds.length > 0) {
        const { data: members } = await supabase
          .from("employees")
          .select("id, first_name, last_name, email, department, job_title, location, status, hire_date")
          .in("id", memberIds)
          .order("first_name", { ascending: true });

        setTeamMembers(members || []);
      } else {
        setTeamMembers([]);
      }
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchTeamMembers();
  }, [fetchTeamMembers]);

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase();
  };

  const handleViewAttendance = (member: TeamMember) => {
    setSelectedMember(member);
    setAttendanceDialogOpen(true);
  };

  const showStatus = (type: "success" | "error", text: string) => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage(null), 5000);
  };

  const handleTeamAdded = async (success: boolean, count: number) => {
    await fetchTeamMembers();
    if (success) {
      showStatus("success", `${count} employee${count > 1 ? "s" : ""} successfully added to your team.`);
    } else {
      showStatus("error", "Failed to assign employees. Please try again.");
    }
  };

  const handleRemoveFromTeam = async (member: TeamMember) => {
    const { error } = await supabase
      .from("employees")
      .update({ line_manager_id: null })
      .eq("id", member.id);

    if (!error) {
      toast({
        title: "Removed from Team",
        description: `${member.first_name} ${member.last_name} has been removed from your team.`,
      });
      await fetchTeamMembers();
      showStatus("success", `${member.first_name} ${member.last_name} removed from your team.`);
    } else {
      showStatus("error", "Failed to remove employee from team. Please try again.");
    }
  };

  if (loading) {
    return null;
  }

  return (
    <>
      <Card className="mb-6 animate-fade-in">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="font-display text-lg flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              My Team ({teamMembers.length} members)
            </CardTitle>
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => setAddToTeamOpen(true)}
            >
              <UserPlus className="h-4 w-4" />
              Add to Team
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {statusMessage && (
            <Alert
              variant={statusMessage.type === "error" ? "destructive" : "default"}
              className={`mb-4 ${statusMessage.type === "success" ? "border-green-500/50 text-green-700 bg-green-50 dark:text-green-400 dark:bg-green-950/30" : ""}`}
            >
              {statusMessage.type === "success" ? (
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <AlertDescription className="flex items-center justify-between">
                <span>{statusMessage.text}</span>
                <Button variant="ghost" size="icon" className="h-5 w-5 -mr-1" onClick={() => setStatusMessage(null)}>
                  <X className="h-3 w-3" />
                </Button>
              </AlertDescription>
            </Alert>
          )}
          {teamMembers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm font-medium">No team members yet</p>
              <p className="text-xs mt-1">Click "Add to Team" to assign employees to your team.</p>
            </div>
          ) : (
            <div className="rounded-lg border overflow-x-auto">
              <Table className="min-w-[600px]">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="font-semibold">Employee</TableHead>
                    <TableHead className="font-semibold">Role</TableHead>
                    <TableHead className="font-semibold">Department</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamMembers.map((member) => (
                    <TableRow key={member.id} className="group">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="bg-primary/10 text-primary font-medium text-sm">
                              {getInitials(member.first_name, member.last_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{member.first_name} {member.last_name}</p>
                            <p className="text-sm text-muted-foreground">{member.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{member.job_title || "-"}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-normal">
                          {member.department || "-"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            member.status === "active" && "border-success/50 text-success bg-success/10"
                          )}
                        >
                          {member.status || "active"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1"
                            onClick={() => handleViewAttendance(member)}
                          >
                            <Clock className="h-3 w-3" />
                            Attendance
                          </Button>
                          {canRequestPromotion && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1"
                              onClick={() => {
                                setPromotionMember(member);
                                setPromotionOpen(true);
                              }}
                            >
                              <TrendingUp className="h-3 w-3" />
                              Request Promotion
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => window.open(`mailto:${member.email}`, '_blank')}
                          >
                            <Mail className="h-4 w-4 text-muted-foreground" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleRemoveFromTeam(member)}
                            title="Remove from team"
                          >
                            <UserMinus className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <TeamMemberAttendanceDialog
        employee={selectedMember}
        open={attendanceDialogOpen}
        onOpenChange={setAttendanceDialogOpen}
      />

      <AddToTeamDialog
        open={addToTeamOpen}
        onOpenChange={setAddToTeamOpen}
        currentTeamMemberIds={teamMembers.map((m) => m.id)}
        onAdded={handleTeamAdded}
      />

      <RequestPromotionDialog
        open={promotionOpen}
        onOpenChange={(open) => {
          setPromotionOpen(open);
          if (!open) {
            setPromotionMember(null);
          }
        }}
        employee={
          promotionMember
            ? {
                id: String(promotionMember.id),
                first_name: promotionMember.first_name,
                last_name: promotionMember.last_name,
                job_title: promotionMember.job_title,
              }
            : null
        }
      />
    </>
  );
}
