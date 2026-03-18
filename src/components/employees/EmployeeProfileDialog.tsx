import { useState, useEffect, lazy, Suspense } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Mail,
  Phone,
  MapPin,
  Building,
  Briefcase,
  Users,
  Loader2,
  TrendingUp,
  ChevronRight,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const LazyRequestPromotionDialog = lazy(() =>
  import("@/components/employees/RequestPromotionDialog").then((module) => ({
    default: module.RequestPromotionDialog,
  })),
);

interface Employee {
  id: number | string;
  name: string;
  email: string;
  role: string;
  department: string;
  location: string;
  status: string;
  initials: string;
  phone: string;
}

interface TeamMember {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  department: string | null;
  job_title: string | null;
  status: string | null;
}

interface SubTeamView {
  employeeId: string;
  employeeName: string;
}

interface EmployeeProfileDialogProps {
  employee: Employee | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Fetch all team members from both junction table AND legacy columns, deduplicated */
async function fetchCombinedTeam(employeeId: string): Promise<TeamMember[]> {
  // 1. Junction table (team_members)
  const { data: junctionRows } = await supabase
    .from("team_members")
    .select("member_employee_id")
    .eq("manager_employee_id", employeeId);

  const junctionIds = (junctionRows || []).map((r: any) => r.member_employee_id);

  // 2. Legacy columns (line_manager_id, manager_id)
  const { data: lineReports } = await supabase
    .from("employees")
    .select("id, first_name, last_name, email, department, job_title, status")
    .eq("line_manager_id", employeeId)
    .order("first_name", { ascending: true });

  const { data: managerReports } = await supabase
    .from("employees")
    .select("id, first_name, last_name, email, department, job_title, status")
    .eq("manager_id", employeeId)
    .order("first_name", { ascending: true });

  // 3. Fetch junction members not already covered by legacy queries
  const legacyIds = new Set([...(lineReports || []).map((e) => e.id), ...(managerReports || []).map((e) => e.id)]);
  const missingJunctionIds = junctionIds.filter((id) => !legacyIds.has(id));

  let junctionMembers: TeamMember[] = [];
  if (missingJunctionIds.length > 0) {
    const { data } = await supabase
      .from("employees")
      .select("id, first_name, last_name, email, department, job_title, status")
      .in("id", missingJunctionIds)
      .order("first_name", { ascending: true });
    junctionMembers = data || [];
  }

  // 4. Merge & deduplicate
  const allReports = [...(lineReports || []), ...(managerReports || []), ...junctionMembers];
  const uniqueReports = allReports.filter((emp, index, self) => self.findIndex((e) => e.id === emp.id) === index);
  uniqueReports.sort((a, b) => a.first_name.localeCompare(b.first_name));
  return uniqueReports;
}

/** Check which employee IDs have sub-teams (junction table OR legacy columns) */
async function detectManagers(employeeIds: string[]): Promise<Set<string>> {
  if (employeeIds.length === 0) return new Set();

  const ids = new Set<string>();

  // Check junction table
  const { data: junctionManagers } = await supabase
    .from("team_members")
    .select("manager_employee_id")
    .in("manager_employee_id", employeeIds);
  (junctionManagers || []).forEach((r: any) => {
    if (r.manager_employee_id) ids.add(r.manager_employee_id);
  });

  // Check legacy columns
  const { data: lineManaged } = await supabase
    .from("employees")
    .select("line_manager_id")
    .in("line_manager_id", employeeIds);
  (lineManaged || []).forEach((r: any) => {
    if (r.line_manager_id) ids.add(r.line_manager_id);
  });

  const { data: managed } = await supabase.from("employees").select("manager_id").in("manager_id", employeeIds);
  (managed || []).forEach((r: any) => {
    if (r.manager_id) ids.add(r.manager_id);
  });

  return ids;
}

export function EmployeeProfileDialog({ employee, open, onOpenChange }: EmployeeProfileDialogProps) {
  const { role, profile, isVP, isAdmin, isManager, isLineManager, isSupervisor } = useAuth();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [promotionOpen, setPromotionOpen] = useState(false);

  // --- Sub-team drill-down state ---
  const [subTeamDialogOpen, setSubTeamDialogOpen] = useState(false);
  const [subTeamMembers, setSubTeamMembers] = useState<TeamMember[]>([]);
  const [subTeamLoading, setSubTeamLoading] = useState(false);
  const [subTeamStack, setSubTeamStack] = useState<SubTeamView[]>([]);
  const [managerIds, setManagerIds] = useState<Set<string>>(new Set());

  const badgeText = `${profile?.job_title || ""} ${role || ""}`.toLowerCase();
  const hasBadgeRoleAccess =
    badgeText.includes("line manager") ||
    badgeText.includes("manager") ||
    badgeText.includes("supervisor") ||
    badgeText.includes("admin") ||
    badgeText.includes("vp") ||
    badgeText.includes("ceo");
  const canRequestPromotionInTeamTab =
    isVP || isAdmin || isManager || isLineManager || isSupervisor || hasBadgeRoleAccess;

  useEffect(() => {
    if (open && employee?.id) {
      fetchTeamForEmployee(String(employee.id));
    } else {
      setTeamMembers([]);
      setManagerIds(new Set());
    }
  }, [open, employee?.id]);

  const fetchTeamForEmployee = async (employeeId: string) => {
    setLoadingTeam(true);
    try {
      const members = await fetchCombinedTeam(employeeId);
      setTeamMembers(members);

      const mgrIds = await detectManagers(members.map((m) => m.id));
      setManagerIds(mgrIds);
    } catch (err) {
      console.error("Failed to fetch team members:", err);
      setTeamMembers([]);
    }
    setLoadingTeam(false);
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase();
  };

  // ─── Sub-team drill-down helpers ───

  const openSubTeam = async (member: TeamMember) => {
    setSubTeamLoading(true);
    setSubTeamDialogOpen(true);
    setSubTeamStack([{ employeeId: member.id, employeeName: `${member.first_name} ${member.last_name}` }]);
    await fetchSubTeamFor(member.id);
    setSubTeamLoading(false);
  };

  const drillInto = async (member: TeamMember) => {
    setSubTeamLoading(true);
    setSubTeamStack((prev) => [
      ...prev,
      { employeeId: member.id, employeeName: `${member.first_name} ${member.last_name}` },
    ]);
    await fetchSubTeamFor(member.id);
    setSubTeamLoading(false);
  };

  const goBack = async () => {
    if (subTeamStack.length <= 1) {
      closeSubTeamDialog();
      return;
    }
    setSubTeamLoading(true);
    const newStack = subTeamStack.slice(0, -1);
    setSubTeamStack(newStack);
    await fetchSubTeamFor(newStack[newStack.length - 1].employeeId);
    setSubTeamLoading(false);
  };

  const fetchSubTeamFor = async (managerId: string) => {
    try {
      const members = await fetchCombinedTeam(managerId);
      setSubTeamMembers(members);

      const mgrIds = await detectManagers(members.map((m) => m.id));
      setManagerIds((prev) => {
        const merged = new Set(prev);
        mgrIds.forEach((id) => merged.add(id));
        return merged;
      });
    } catch (err) {
      console.error("Failed to fetch sub-team:", err);
      setSubTeamMembers([]);
    }
  };

  const closeSubTeamDialog = () => {
    setSubTeamDialogOpen(false);
    setSubTeamStack([]);
    setSubTeamMembers([]);
  };

  const currentBreadcrumbName = subTeamStack.length > 0 ? subTeamStack[subTeamStack.length - 1].employeeName : "";

  if (!employee) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("sm:max-w-md", teamMembers.length > 0 && "sm:max-w-2xl")}>
        <DialogHeader>
          <DialogTitle className="font-display">Employee Profile</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 max-h-[75vh] overflow-y-auto pr-1">
          {/* Header with Avatar */}
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src="" />
              <AvatarFallback className="bg-primary/10 text-primary text-2xl font-medium">
                {employee.initials}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="text-xl font-semibold">{employee.name}</h3>
              <p className="text-muted-foreground">{employee.role}</p>
              <Badge
                variant="outline"
                className={cn(
                  "mt-2",
                  employee.status === "active" && "border-success/50 text-success bg-success/10",
                  employee.status === "probation" && "border-warning/50 text-warning bg-warning/10",
                  employee.status === "inactive" && "border-destructive/50 text-destructive bg-destructive/10",
                )}
              >
                {employee.status}
              </Badge>
            </div>
          </div>

          <Separator />

          {/* Contact Info */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Contact Information</h4>
            <div className="space-y-2">
              <div className="flex items-center gap-3 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <a href={`mailto:${employee.email}`} className="text-primary hover:underline">
                  {employee.email}
                </a>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{employee.phone || "Not provided"}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="flex items-center gap-2">
                  {employee.location === "US" ? "🇺🇸" : "🇳🇵"} {employee.location}
                </span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Work Info */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Work Information</h4>
            <div className="space-y-2">
              <div className="flex items-center gap-3 text-sm">
                <Building className="h-4 w-4 text-muted-foreground" />
                <span>{employee.department}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Briefcase className="h-4 w-4 text-muted-foreground" />
                <span>{employee.role}</span>
              </div>
            </div>
          </div>

          {/* Team Section */}
          {canRequestPromotionInTeamTab && !loadingTeam && teamMembers.length === 0 && (
            <>
              <Separator />
              <Button variant="outline" className="w-full gap-2" onClick={() => setPromotionOpen(true)}>
                <TrendingUp className="h-4 w-4" />
                Request Promotion
              </Button>
            </>
          )}

          {loadingTeam ? (
            <>
              <Separator />
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            </>
          ) : teamMembers.length > 0 ? (
            <>
              <Separator />
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    Team Members ({teamMembers.length})
                  </h4>
                  {canRequestPromotionInTeamTab && (
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setPromotionOpen(true)}>
                      <TrendingUp className="h-4 w-4" />
                      Request Promotion
                    </Button>
                  )}
                </div>
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
                      {teamMembers.map((member) => {
                        const isSubManager = managerIds.has(member.id);
                        return (
                          <TableRow
                            key={member.id}
                            className={cn(isSubManager && "cursor-pointer hover:bg-accent/50")}
                            onClick={() => {
                              if (isSubManager) openSubTeam(member);
                            }}
                          >
                            <TableCell className="py-2">
                              <div className="flex items-center gap-2">
                                <Avatar className="h-7 w-7">
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
                            <TableCell className="py-2 text-sm">{member.job_title || "-"}</TableCell>
                            <TableCell className="py-2">
                              <Badge variant="secondary" className="font-normal text-xs">
                                {member.department || "-"}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-2">
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
              </div>
            </>
          ) : null}
        </div>
      </DialogContent>

      {/* ─── Sub-team Drill-down Modal ─── */}
      <Dialog
        open={subTeamDialogOpen}
        onOpenChange={(o) => {
          if (!o) closeSubTeamDialog();
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

      {/* Promotion Request Dialog */}
      <Suspense fallback={null}>
        <LazyRequestPromotionDialog
          open={promotionOpen}
          onOpenChange={setPromotionOpen}
          employee={employee ? { ...employee, id: String(employee.id) } : null}
        />
      </Suspense>
    </Dialog>
  );
}
