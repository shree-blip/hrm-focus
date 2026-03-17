import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Users,
  Clock,
  Mail,
  UserPlus,
  UserMinus,
  CheckCircle2,
  AlertCircle,
  X,
  TrendingUp,
  ChevronRight,
  ArrowLeft,
  Loader2,
} from "lucide-react";
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

/** Tracks which employee's sub-team we're viewing in the drill-down modal */
interface SubTeamView {
  employeeId: string;
  employeeName: string;
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

  // --- Sub-team drill-down state ---
  const [subTeamDialogOpen, setSubTeamDialogOpen] = useState(false);
  const [subTeamMembers, setSubTeamMembers] = useState<TeamMember[]>([]);
  const [subTeamLoading, setSubTeamLoading] = useState(false);
  /** Breadcrumb stack for nested drill-down navigation */
  const [subTeamStack, setSubTeamStack] = useState<SubTeamView[]>([]);
  /** Set of employee IDs that are also managers (have sub-teams) */
  const [managerIds, setManagerIds] = useState<Set<string>>(new Set());

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

    const { data: employeeId } = await supabase.rpc("get_employee_id_for_user", {
      _user_id: user.id,
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

        // Check which of these members are also managers (have their own sub-teams)
        await detectManagersAmong(memberIds);
      } else {
        setTeamMembers([]);
      }
    }
    setLoading(false);
  }, [user]);

  /** Check which employee IDs have sub-teams in the team_members table */
  const detectManagersAmong = async (employeeIds: string[]) => {
    if (employeeIds.length === 0) {
      setManagerIds(new Set());
      return;
    }

    const { data: managerRows } = await supabase
      .from("team_members")
      .select("manager_employee_id")
      .in("manager_employee_id", employeeIds);

    const ids = new Set((managerRows || []).map((r: any) => r.manager_employee_id));
    setManagerIds(ids);
  };

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
    if (!user) return;
    const { data: employeeId } = await supabase.rpc("get_employee_id_for_user", {
      _user_id: user.id,
    });

    const { error } = await supabase
      .from("team_members")
      .delete()
      .eq("manager_employee_id", employeeId)
      .eq("member_employee_id", member.id);

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

  // ─── Sub-team drill-down helpers ───

  /** Fetch sub-team for a given employee and open/navigate the modal */
  const openSubTeam = async (employee: TeamMember) => {
    setSubTeamLoading(true);
    setSubTeamDialogOpen(true);

    // Push onto breadcrumb stack
    setSubTeamStack((prev) => [
      ...prev,
      { employeeId: employee.id, employeeName: `${employee.first_name} ${employee.last_name}` },
    ]);

    await fetchSubTeamFor(employee.id);
    setSubTeamLoading(false);
  };

  /** Drill deeper into a sub-team member who is also a manager */
  const drillInto = async (employee: TeamMember) => {
    setSubTeamLoading(true);

    setSubTeamStack((prev) => [
      ...prev,
      { employeeId: employee.id, employeeName: `${employee.first_name} ${employee.last_name}` },
    ]);

    await fetchSubTeamFor(employee.id);
    setSubTeamLoading(false);
  };

  /** Go back one level in the breadcrumb */
  const goBack = async () => {
    if (subTeamStack.length <= 1) {
      // Close the dialog entirely
      closeSubTeamDialog();
      return;
    }

    setSubTeamLoading(true);
    const newStack = subTeamStack.slice(0, -1);
    setSubTeamStack(newStack);

    const parentView = newStack[newStack.length - 1];
    await fetchSubTeamFor(parentView.employeeId);
    setSubTeamLoading(false);
  };

  /** Fetch team members for a specific manager employee ID */
  const fetchSubTeamFor = async (managerId: string) => {
    const { data: teamRows } = await supabase
      .from("team_members")
      .select("member_employee_id")
      .eq("manager_employee_id", managerId);

    const memberIds = (teamRows || []).map((r: any) => r.member_employee_id);

    if (memberIds.length > 0) {
      const { data: members } = await supabase
        .from("employees")
        .select("id, first_name, last_name, email, department, job_title, location, status, hire_date")
        .in("id", memberIds)
        .order("first_name", { ascending: true });

      setSubTeamMembers(members || []);

      // Detect which of these sub-members are also managers
      const { data: managerRows } = await supabase
        .from("team_members")
        .select("manager_employee_id")
        .in("manager_employee_id", memberIds);

      const ids = new Set((managerRows || []).map((r: any) => r.manager_employee_id));
      // Merge with existing managerIds so we keep the parent-level info too
      setManagerIds((prev) => {
        const merged = new Set(prev);
        ids.forEach((id) => merged.add(id));
        return merged;
      });
    } else {
      setSubTeamMembers([]);
    }
  };

  const closeSubTeamDialog = () => {
    setSubTeamDialogOpen(false);
    setSubTeamStack([]);
    setSubTeamMembers([]);
  };

  const currentBreadcrumbName = subTeamStack.length > 0 ? subTeamStack[subTeamStack.length - 1].employeeName : "";

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
            <Button size="sm" className="gap-1.5" onClick={() => setAddToTeamOpen(true)}>
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
                  {teamMembers.map((member) => {
                    const isSubManager = managerIds.has(member.id);
                    return (
                      <TableRow
                        key={member.id}
                        className={cn("group", isSubManager && "cursor-pointer hover:bg-accent/50")}
                        onClick={() => {
                          if (isSubManager) openSubTeam(member);
                        }}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9">
                              <AvatarFallback className="bg-primary/10 text-primary font-medium text-sm">
                                {getInitials(member.first_name, member.last_name)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-medium">
                                  {member.first_name} {member.last_name}
                                </p>
                                {isSubManager && (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] px-1.5 py-0 border-primary/40 text-primary"
                                  >
                                    <Users className="h-2.5 w-2.5 mr-0.5" />
                                    Team Lead
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">{member.email}</p>
                            </div>
                            {isSubManager && (
                              <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                            )}
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
                            className={cn(member.status === "active" && "border-success/50 text-success bg-success/10")}
                          >
                            {member.status || "active"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
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
                              onClick={() => window.open(`mailto:${member.email}`, "_blank")}
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
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Sub-team Drill-down Modal ─── */}
      <Dialog
        open={subTeamDialogOpen}
        onOpenChange={(open) => {
          if (!open) closeSubTeamDialog();
        }}
      >
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              {subTeamStack.length > 1 && (
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={goBack}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
              <div>
                <DialogTitle className="font-display text-lg flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  {currentBreadcrumbName}'s Team
                </DialogTitle>
                {/* Breadcrumb trail */}
                {subTeamStack.length > 1 && (
                  <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground flex-wrap">
                    {subTeamStack.map((item, idx) => (
                      <span key={item.employeeId} className="flex items-center gap-1">
                        {idx > 0 && <ChevronRight className="h-3 w-3" />}
                        <span className={idx === subTeamStack.length - 1 ? "text-foreground font-medium" : ""}>
                          {item.employeeName}
                        </span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </DialogHeader>

          {subTeamLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : subTeamMembers.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No team members under {currentBreadcrumbName}</p>
            </div>
          ) : (
            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="font-semibold text-xs">Employee</TableHead>
                    <TableHead className="font-semibold text-xs">Role</TableHead>
                    <TableHead className="font-semibold text-xs">Department</TableHead>
                    <TableHead className="font-semibold text-xs">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subTeamMembers.map((member) => {
                    const isSubManager = managerIds.has(member.id);
                    return (
                      <TableRow
                        key={member.id}
                        className={cn(isSubManager && "cursor-pointer hover:bg-accent/50")}
                        onClick={() => {
                          if (isSubManager) drillInto(member);
                        }}
                      >
                        <TableCell className="py-2.5">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="bg-primary/10 text-primary font-medium text-xs">
                                {getInitials(member.first_name, member.last_name)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <p className="font-medium text-sm">
                                  {member.first_name} {member.last_name}
                                </p>
                                {isSubManager && (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] px-1.5 py-0 border-primary/40 text-primary"
                                  >
                                    <Users className="h-2.5 w-2.5 mr-0.5" />
                                    Team Lead
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">{member.email}</p>
                            </div>
                            {isSubManager && <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto" />}
                          </div>
                        </TableCell>
                        <TableCell className="py-2.5 text-sm">{member.job_title || "-"}</TableCell>
                        <TableCell className="py-2.5">
                          <Badge variant="secondary" className="font-normal text-xs">
                            {member.department || "-"}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-2.5">
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-xs",
                              member.status === "active" && "border-success/50 text-success bg-success/10",
                              member.status === "probation" && "border-warning/50 text-warning bg-warning/10",
                              member.status === "inactive" &&
                                "border-destructive/50 text-destructive bg-destructive/10",
                            )}
                          >
                            {member.status || "active"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>

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
