import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Search,
  Plus,
  Filter,
  Mail,
  MapPin,
  Loader2,
  User,
  Edit,
  Clock,
  UserX,
  Users,
  UserPlus,
  UserMinus,
  TrendingUp,
  ChevronRight,
  ArrowLeft,
  CalendarDays,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EmployeeProfileDialog } from "@/components/employees/EmployeeProfileDialog";
import { EditEmployeeDialog } from "@/components/employees/EditEmployeeDialog";
import { TimesheetDialog } from "@/components/employees/TimesheetDialog";
import { DeactivateDialog } from "@/components/employees/DeactivateDialog";
import { AddEmployeeDialog } from "@/components/employees/AddEmployeeDialog";
import { AddToTeamDialog } from "@/components/employees/AddToTeamDialog";
import { RequestPromotionDialog } from "@/components/employees/RequestPromotionDialog";
import { useEmployees } from "@/hooks/useEmployees";
import { useAuth } from "@/contexts/AuthContext";
import { MyTeamSection } from "@/components/employees/MyTeamSection";
import { useAvatarUrl } from "@/hooks/useAvatarUrl";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface ClickedEmployeeTeamMember {
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

/** Fetch all team members from both junction table AND legacy columns, deduplicated */
async function fetchCombinedTeam(employeeId: string): Promise<ClickedEmployeeTeamMember[]> {
  // Fetch junction table and legacy columns in parallel
  const [junctionResult, lineReportsResult, managerReportsResult] = await Promise.all([
    supabase.from("team_members").select("member_employee_id").eq("manager_employee_id", employeeId),
    supabase
      .from("employees")
      .select("id, first_name, last_name, email, department, job_title, status")
      .eq("line_manager_id", employeeId)
      .order("first_name", { ascending: true }),
    supabase
      .from("employees")
      .select("id, first_name, last_name, email, department, job_title, status")
      .eq("manager_id", employeeId)
      .order("first_name", { ascending: true }),
  ]);

  const junctionIds = (junctionResult.data || []).map((r: any) => r.member_employee_id);
  const lineReports = lineReportsResult.data || [];
  const managerReports = managerReportsResult.data || [];

  // Fetch junction members not already covered by legacy queries
  const legacyIds = new Set([...lineReports.map((e) => e.id), ...managerReports.map((e) => e.id)]);
  const missingJunctionIds = junctionIds.filter((id) => !legacyIds.has(id));

  let junctionMembers: ClickedEmployeeTeamMember[] = [];
  if (missingJunctionIds.length > 0) {
    const { data } = await supabase
      .from("employees")
      .select("id, first_name, last_name, email, department, job_title, status")
      .in("id", missingJunctionIds)
      .order("first_name", { ascending: true });
    junctionMembers = data || [];
  }

  // Merge & deduplicate
  const allReports = [...lineReports, ...managerReports, ...junctionMembers];
  const uniqueReports = allReports.filter((emp, index, self) => self.findIndex((e) => e.id === emp.id) === index);
  uniqueReports.sort((a, b) => a.first_name.localeCompare(b.first_name));
  return uniqueReports;
}

/** Check which employee IDs have sub-teams (junction table OR legacy columns) */
async function detectManagersAmong(employeeIds: string[]): Promise<Set<string>> {
  if (employeeIds.length === 0) return new Set();

  // Check all sources in parallel
  const [junctionResult, lineResult, managerResult] = await Promise.all([
    supabase.from("team_members").select("manager_employee_id").in("manager_employee_id", employeeIds),
    supabase.from("employees").select("line_manager_id").in("line_manager_id", employeeIds),
    supabase.from("employees").select("manager_id").in("manager_id", employeeIds),
  ]);

  const ids = new Set<string>();
  (junctionResult.data || []).forEach((r: any) => {
    if (r.manager_employee_id) ids.add(r.manager_employee_id);
  });
  (lineResult.data || []).forEach((r: any) => {
    if (r.line_manager_id) ids.add(r.line_manager_id);
  });
  (managerResult.data || []).forEach((r: any) => {
    if (r.manager_id) ids.add(r.manager_id);
  });

  return ids;
}

// Component to handle individual employee avatar with signed URL
const EmployeeAvatar = ({ employee }: { employee: any }) => {
  const avatarPath = employee.profiles?.avatar_url || employee.avatar_url;
  const { signedUrl } = useAvatarUrl(avatarPath);

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase();
  };

  return (
    <Avatar className="h-10 w-10">
      <AvatarImage src={signedUrl || ""} />
      <AvatarFallback className="bg-primary/10 text-primary font-medium">
        {getInitials(employee.first_name, employee.last_name)}
      </AvatarFallback>
    </Avatar>
  );
};

const Employees = () => {
  const { employees, loading, createEmployee, updateEmployee, deactivateEmployee } = useEmployees();
  const { user, isManager, isVP, isAdmin, isLineManager, isSupervisor, canCreateEmployee } = useAuth();

  const [searchQuery, setSearchQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [clickedEmployee, setClickedEmployee] = useState<any | null>(null);

  // Team members for the clicked employee in popup
  const [clickedEmployeeTeam, setClickedEmployeeTeam] = useState<ClickedEmployeeTeamMember[]>([]);
  const [loadingClickedTeam, setLoadingClickedTeam] = useState(false);

  // Sub-team drill-down state
  const [subTeamDialogOpen, setSubTeamDialogOpen] = useState(false);
  const [subTeamMembers, setSubTeamMembers] = useState<ClickedEmployeeTeamMember[]>([]);
  const [subTeamLoading, setSubTeamLoading] = useState(false);
  const [subTeamStack, setSubTeamStack] = useState<SubTeamView[]>([]);
  const [clickedTeamManagerIds, setClickedTeamManagerIds] = useState<Set<string>>(new Set());

  // Add to team dialog for managing another employee's team (VP/admin)
  const [manageTeamDialogOpen, setManageTeamDialogOpen] = useState(false);
  const [managingEmployeeId, setManagingEmployeeId] = useState<string | null>(null);

  // Leave summary for clicked employee
  interface LeaveBalanceSummary {
    leave_type: string;
    total_days: number;
    used_days: number;
    remaining_days: number;
  }
  const [clickedLeaveBalances, setClickedLeaveBalances] = useState<LeaveBalanceSummary[]>([]);
  const [loadingLeave, setLoadingLeave] = useState(false);
  const [leaveSummaryOpen, setLeaveSummaryOpen] = useState(false);

  // Dialog states
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<any | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [timesheetOpen, setTimesheetOpen] = useState(false);
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [promotionPickerOpen, setPromotionPickerOpen] = useState(false);
  const [promotionDialogOpen, setPromotionDialogOpen] = useState(false);
  const [promotionEmployeeId, setPromotionEmployeeId] = useState<string>("");
  const [promotionTarget, setPromotionTarget] = useState<any | null>(null);

  // Only VP/Admin see the full employee directory; managers/line managers/supervisors see only their team
  const showFullDirectory = isVP || isAdmin;
  const showMyTeamSection = (isLineManager || isSupervisor || isManager) && !isVP;

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase();
  };

  // Fetch team for clicked employee — now uses combined fetch (junction + legacy)
  const fetchClickedEmployeeTeam = async (employeeId: string) => {
    setLoadingClickedTeam(true);
    try {
      const members = await fetchCombinedTeam(employeeId);
      setClickedEmployeeTeam(members);

      const mgrIds = await detectManagersAmong(members.map((m) => m.id));
      setClickedTeamManagerIds(mgrIds);
    } catch (err) {
      console.error("Failed to fetch team:", err);
      setClickedEmployeeTeam([]);
    }
    setLoadingClickedTeam(false);
  };

  // ─── Sub-team drill-down helpers ───

  const openSubTeamFromClicked = async (member: ClickedEmployeeTeamMember) => {
    setSubTeamLoading(true);
    setSubTeamDialogOpen(true);
    setSubTeamStack([{ employeeId: member.id, employeeName: `${member.first_name} ${member.last_name}` }]);
    await fetchSubTeamFor(member.id);
    setSubTeamLoading(false);
  };

  const drillIntoSubTeam = async (member: ClickedEmployeeTeamMember) => {
    setSubTeamLoading(true);
    setSubTeamStack((prev) => [
      ...prev,
      { employeeId: member.id, employeeName: `${member.first_name} ${member.last_name}` },
    ]);
    await fetchSubTeamFor(member.id);
    setSubTeamLoading(false);
  };

  const goBackSubTeam = async () => {
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

      const mgrIds = await detectManagersAmong(members.map((m) => m.id));
      setClickedTeamManagerIds((prev) => {
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

  const currentSubTeamName = subTeamStack.length > 0 ? subTeamStack[subTeamStack.length - 1].employeeName : "";

  // Fetch leave balances and approved requests for an employee (fiscal year ends June 30)
  const fetchClickedEmployeeLeave = async (employeeUserId: string | null) => {
    if (!employeeUserId) {
      setClickedLeaveBalances([]);
      return;
    }

    setLoadingLeave(true);
    try {
      const now = new Date();
      // Fiscal year: Jul 1 – Jun 30. Determine current fiscal year start.
      const fyStartYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
      const fyStart = `${fyStartYear}-07-01`;
      const fyEnd = `${fyStartYear + 1}-06-30`;

      // Fetch leave balances for the fiscal year
      const { data: balances } = await supabase
        .from("leave_balances")
        .select("leave_type, total_days, used_days")
        .eq("user_id", employeeUserId)
        .eq("year", fyStartYear + 1);

      // Also fetch actual approved leave requests within the fiscal year period
      const { data: approvedRequests } = await supabase
        .from("leave_requests")
        .select("leave_type, days, is_half_day")
        .eq("user_id", employeeUserId)
        .eq("status", "approved")
        .gte("start_date", fyStart)
        .lte("start_date", fyEnd);

      // Build a map of used days from approved requests
      const usedMap = new Map<string, number>();
      (approvedRequests || []).forEach((r: { leave_type: string; days: number; is_half_day: boolean | null }) => {
        // Normalize type: "Other Leave - Sick Leave" → "Sick Leave", "Other Leave - X" → "Other Leave"
        let type = r.leave_type;
        if (type === "Other Leave - Sick Leave") type = "Sick Leave";
        else if (type.startsWith("Other Leave -")) type = "Other Leave";
        else if (type.startsWith("Leave on Lieu")) type = "Leave on Lieu";

        const dayCount = r.is_half_day ? 0.5 : r.days;
        usedMap.set(type, (usedMap.get(type) || 0) + dayCount);
      });

      // Build summary from balances table + request-based used days
      const balanceMap = new Map<string, { total: number; used: number }>();

      // Seed from leave_balances rows
      (balances || []).forEach((b: { leave_type: string; total_days: number; used_days: number }) => {
        balanceMap.set(b.leave_type, {
          total: Number(b.total_days),
          used: Number(b.used_days),
        });
      });

      // For types that appear in requests but NOT in balances, add them
      usedMap.forEach((used, type) => {
        if (!balanceMap.has(type)) {
          balanceMap.set(type, { total: 0, used });
        }
      });

      const summaries: LeaveBalanceSummary[] = [];
      balanceMap.forEach((val, type) => {
        summaries.push({
          leave_type: type,
          total_days: val.total,
          used_days: val.used,
          remaining_days: Math.max(0, val.total - val.used),
        });
      });

      // Sort: main types first
      const order = ["Annual Leave", "Sick Leave", "Personal Leave"];
      summaries.sort((a, b) => {
        const ai = order.indexOf(a.leave_type);
        const bi = order.indexOf(b.leave_type);
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      });

      setClickedLeaveBalances(summaries);
    } catch (err) {
      console.error("Failed to fetch leave:", err);
      setClickedLeaveBalances([]);
    }
    setLoadingLeave(false);
  };

  // When clicked employee changes, fetch their team and leave
  useEffect(() => {
    if (clickedEmployee?.id) {
      fetchClickedEmployeeTeam(String(clickedEmployee.id));
      fetchClickedEmployeeLeave(clickedEmployee.user_id || null);
    } else {
      setClickedEmployeeTeam([]);
      setClickedTeamManagerIds(new Set());
      setClickedLeaveBalances([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clickedEmployee?.id]);

  const handleRemoveFromClickedTeam = async (member: ClickedEmployeeTeamMember) => {
    if (!clickedEmployee) return;
    const managerId = String(clickedEmployee.id);

    // Delete from junction table
    await supabase
      .from("team_members")
      .delete()
      .eq("manager_employee_id", managerId)
      .eq("member_employee_id", member.id);

    // Also clear legacy columns if they reference this manager
    const { data: memberData } = await supabase
      .from("employees")
      .select("line_manager_id, manager_id")
      .eq("id", member.id)
      .single();

    if (memberData) {
      const updates: any = {};
      if (memberData.line_manager_id === managerId) updates.line_manager_id = null;
      if (memberData.manager_id === managerId) updates.manager_id = null;
      if (Object.keys(updates).length > 0) {
        await supabase.from("employees").update(updates).eq("id", member.id);
      }
    }
    // Send removal email notification
    try {
      await supabase.functions.invoke("send-team-assignment-notification", {
        body: {
          action: "removed",
          assigner_name: user?.user_metadata?.full_name || user?.email || "System",
          assigner_email: user?.email || "",
          employee_name: `${member.first_name} ${member.last_name}`,
          employee_email: member.email,
          manager_name: `${clickedEmployee.first_name} ${clickedEmployee.last_name}`,
        },
      });
    } catch (err) {
      console.error("Failed to send removal notification:", err);
    }
    toast({
      title: "Removed from Team",
      description: `${member.first_name} ${member.last_name} has been removed from ${clickedEmployee.first_name}'s team.`,
    });
    fetchClickedEmployeeTeam(managerId);
  };

  const handleManageTeam = () => {
    if (!clickedEmployee) return;
    setManagingEmployeeId(String(clickedEmployee.id));
    setManageTeamDialogOpen(true);
  };

  const handleTeamMembersAdded = async (success: boolean, count: number) => {
    if (clickedEmployee) {
      await fetchClickedEmployeeTeam(String(clickedEmployee.id));
    }
    if (success) {
      toast({
        title: "Team Updated",
        description: `${count} employee${count > 1 ? "s" : ""} added to ${clickedEmployee?.first_name}'s team.`,
      });
    }
  };

  const filteredEmployees = employees.filter((emp) => {
    const fullName = `${emp.first_name} ${emp.last_name}`.toLowerCase();
    const matchesSearch =
      fullName.includes(searchQuery.toLowerCase()) ||
      emp.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (emp.job_title || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDepartment = departmentFilter === "all" || emp.department === departmentFilter;
    const matchesLocation = locationFilter === "all" || emp.location === locationFilter;
    return matchesSearch && matchesDepartment && matchesLocation;
  });

  const handleViewProfile = (employee: any) => {
    setSelectedEmployee({
      ...employee,
      name: `${employee.first_name} ${employee.last_name}`,
      initials: getInitials(employee.first_name, employee.last_name),
      role: employee.job_title || "Employee",
    });
    setProfileOpen(true);
  };

  const handleEditDetails = (employee: any) => {
    setSelectedEmployee({
      id: employee.id,
      name: `${employee.first_name} ${employee.last_name}`,
      email: employee.email,
      phone: employee.phone || "",
      role: employee.job_title || "",
      department: employee.department || "",
      location: employee.location || "US",
      status: employee.status || "active",
      initials: getInitials(employee.first_name, employee.last_name),
    });
    setEditOpen(true);
  };

  const handleViewTimesheet = (employee: any) => {
    setSelectedEmployee({
      ...employee,
      name: `${employee.first_name} ${employee.last_name}`,
      initials: getInitials(employee.first_name, employee.last_name),
    });
    setTimesheetOpen(true);
  };

  const handleDeactivate = (employee: any) => {
    setSelectedEmployee({
      id: employee.id,
      name: `${employee.first_name} ${employee.last_name}`,
      initials: getInitials(employee.first_name, employee.last_name),
    });
    setDeactivateOpen(true);
  };

  const handleAddEmployee = async (data: {
    name: string;
    email: string;
    role: string;
    department: string;
    location: string;
    status: string;
    phone: string;
    lineManagerId: string | null;
  }) => {
    try {
      const nameParts = (data.name || "").trim().split(/\s+/);
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ") || "";

      if (!firstName || !data.email) {
        throw new Error("Name and email are required.");
      }

      const payload = {
        first_name: firstName,
        last_name: lastName,
        email: data.email.trim(),
        phone: data.phone?.trim() || null,
        department: data.department || null,
        job_title: data.role || null,
        location: data.location || "US",
        status: data.status || "active",
        hire_date: new Date().toISOString().slice(0, 10),
        line_manager_id: data.lineManagerId,
      };

      const res: any = await createEmployee(payload as any);

      if (res?.error) throw res.error;

      // Auto-whitelist the email for signup
      if (res?.id) {
        const { error: whitelistError } = await supabase.from("allowed_signups").upsert(
          {
            email: data.email.trim().toLowerCase(),
            employee_id: res.id,
            invited_by: user?.id || null,
            invited_at: new Date().toISOString(),
            is_used: false,
          },
          { onConflict: "email" },
        );

        if (whitelistError) {
          console.error("Failed to whitelist email:", whitelistError);
          // Try insert without upsert (email column may not have unique constraint)
          await supabase.from("allowed_signups").insert({
            email: data.email.trim().toLowerCase(),
            employee_id: res.id,
            invited_by: user?.id || null,
            invited_at: new Date().toISOString(),
            is_used: false,
          });
        }
      }

      setAddDialogOpen(false);
    } catch (err: any) {
      console.error("Add employee failed:", err);
      alert(err?.message || "Failed to add employee. Check console for details.");
    }
  };

  const handleSaveEmployee = async (updatedEmployee: any) => {
    const nameParts = updatedEmployee.name.split(" ");
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";

    await updateEmployee(updatedEmployee.id, {
      first_name: firstName,
      last_name: lastName,
      email: updatedEmployee.email,
      phone: updatedEmployee.phone || null,
      department: updatedEmployee.department || null,
      job_title: updatedEmployee.role || null,
      location: updatedEmployee.location || "US",
      status: updatedEmployee.status || "active",
    });
  };

  const handleConfirmDeactivate = async (employeeId: number | string) => {
    await deactivateEmployee(employeeId.toString());
  };

  const handleOpenPromotionPicker = () => {
    setPromotionEmployeeId("");
    setPromotionPickerOpen(true);
  };

  const handleStartPromotionRequest = () => {
    const target = employees.find((emp) => String(emp.id) === promotionEmployeeId);
    if (!target) {
      toast({
        title: "Select Employee",
        description: "Please select an employee to request promotion.",
        variant: "destructive",
      });
      return;
    }

    setPromotionTarget({
      id: String(target.id),
      first_name: target.first_name,
      last_name: target.last_name,
      name: `${target.first_name} ${target.last_name}`,
      job_title: target.job_title,
    });
    setPromotionPickerOpen(false);
    setPromotionDialogOpen(true);
  };

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
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 animate-fade-in">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">
            {showMyTeamSection && !showFullDirectory
              ? "My Team"
              : showFullDirectory
                ? "Employees"
                : "Employee Directory"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {showMyTeamSection && !showFullDirectory
              ? "Manage your direct reports"
              : showFullDirectory
                ? "Manage your team members and their roles"
                : "View your colleagues"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isManager && (
            <Button variant="outline" className="gap-2" onClick={handleOpenPromotionPicker}>
              <TrendingUp className="h-4 w-4" />
              Request Promotion
            </Button>
          )}
          {canCreateEmployee && (
            <Button className="gap-2 shadow-md" onClick={() => setAddDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              Add Employee
            </Button>
          )}
        </div>
      </div>

      {/* My Team Section - for Line Managers and Supervisors */}
      {showMyTeamSection && <MyTeamSection />}

      {/* Filters & Employee Table - Only shown if NOT a line manager/supervisor-only role */}
      {showFullDirectory && (
        <>
          {/* Filters */}
          <div
            className="flex flex-col sm:flex-row gap-4 mb-6 animate-slide-up opacity-0"
            style={{ animationDelay: "100ms", animationFillMode: "forwards" }}
          >
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search employees..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                <SelectItem value="Executive">Executive</SelectItem>
                <SelectItem value="Accounting">Accounting</SelectItem>
                <SelectItem value="Tax">Tax</SelectItem>
                <SelectItem value="Operations">Operations</SelectItem>
                <SelectItem value="Marketing">Marketing</SelectItem>
                <SelectItem value="IT">IT</SelectItem>
                <SelectItem value="Healthcare">Healthcare</SelectItem>
                <SelectItem value="Focus Data">Focus Data</SelectItem>
              </SelectContent>
            </Select>

            <Select value={locationFilter} onValueChange={setLocationFilter}>
              <SelectTrigger className="w-full sm:w-[140px]">
                <MapPin className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Location" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                <SelectItem value="US">United States</SelectItem>
                <SelectItem value="Nepal">Nepal</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Employee Table */}
          <div
            className="rounded-xl border border-border bg-card shadow-sm animate-slide-up opacity-0 overflow-x-auto"
            style={{ animationDelay: "200ms", animationFillMode: "forwards" }}
          >
            <Table className="min-w-[800px]">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="font-semibold">Employee</TableHead>
                  <TableHead className="font-semibold">Role</TableHead>
                  <TableHead className="font-semibold">Department</TableHead>
                  <TableHead className="font-semibold">Location</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  {isManager && <TableHead className="font-semibold">Account</TableHead>}
                  <TableHead className="font-semibold">Contact</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {filteredEmployees.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isManager ? 7 : 6} className="text-center py-8 text-muted-foreground">
                      No employees found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEmployees.map((employee, index) => (
                    <TableRow
                      key={employee.id}
                      className="group cursor-pointer animate-fade-in"
                      style={{ animationDelay: `${300 + index * 50}ms` }}
                      onClick={() => setClickedEmployee(employee)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <EmployeeAvatar employee={employee} />
                          <div>
                            <p className="font-medium">
                              {employee.first_name} {employee.last_name}
                            </p>
                            <p className="text-sm text-muted-foreground">{employee.email}</p>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>{employee.job_title || "-"}</TableCell>

                      <TableCell>
                        <Badge variant="secondary" className="font-normal">
                          {employee.department || "-"}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center font-bold gap-2">
                          {employee.location === "US" ? " US" : "NP"}
                        </div>
                      </TableCell>

                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            employee.status === "active" && "border-success/50 text-success bg-success/10",
                            employee.status === "probation" && "border-warning/50 text-warning bg-warning/10",
                            employee.status === "inactive" &&
                              "border-destructive/50 text-destructive bg-destructive/10",
                          )}
                        >
                          {employee.status || "active"}
                        </Badge>
                      </TableCell>

                      {isManager && (
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn(
                              employee.profile_id
                                ? "border-success/50 text-success bg-success/10"
                                : "border-warning/50 text-warning bg-warning/10",
                            )}
                          >
                            {employee.profile_id ? "Registered" : "Pending Signup"}
                          </Badge>
                        </TableCell>
                      )}

                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(`mailto:${employee.email}`, "_blank");
                            }}
                          >
                            <Mail className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Stats Footer */}
          {isManager && (
            <div
              className="flex items-center justify-between mt-6 text-sm text-muted-foreground animate-fade-in"
              style={{ animationDelay: "500ms" }}
            >
              <p>
                Showing {filteredEmployees.length} of {employees.length} employees
              </p>
              <div className="flex items-center gap-4">
                <span>🇺🇸 {filteredEmployees.filter((e) => e.location === "US").length} US</span>
                <span>🇳🇵 {filteredEmployees.filter((e) => e.location === "Nepal").length} Nepal</span>
              </div>
            </div>
          )}
        </>
      )}

      {/* Action Popup Overlay */}
      {clickedEmployee && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center animate-in fade-in duration-200"
          onClick={() => setClickedEmployee(null)}
        >
          <Card
            className="w-full max-w-3xl mx-4 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <CardContent className="p-6">
              {/* Employee Header */}
              <div className="flex items-center gap-4 mb-6">
                <EmployeeAvatar employee={clickedEmployee} />
                <div>
                  <h3 className="font-semibold text-lg">
                    {clickedEmployee.first_name} {clickedEmployee.last_name}
                  </h3>
                  <p className="text-sm text-muted-foreground">{clickedEmployee.job_title || "Employee"}</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className={cn("grid gap-3", isManager ? "grid-cols-2 lg:grid-cols-5" : "grid-cols-1")}>
                <Button
                  variant="outline"
                  className="flex-col h-24 gap-2"
                  onClick={() => {
                    handleViewProfile(clickedEmployee);
                    setClickedEmployee(null);
                  }}
                >
                  <User className="h-6 w-6" />
                  <span className="text-sm font-medium">View Profile</span>
                </Button>

                {isManager && (
                  <>
                    <Button
                      variant="outline"
                      className="flex-col h-24 gap-2"
                      onClick={() => {
                        handleEditDetails(clickedEmployee);
                        setClickedEmployee(null);
                      }}
                    >
                      <Edit className="h-6 w-6" />
                      <span className="text-sm font-medium">Edit Details</span>
                    </Button>

                    <Button
                      variant="outline"
                      className="flex-col h-24 gap-2"
                      onClick={() => {
                        handleViewTimesheet(clickedEmployee);
                        setClickedEmployee(null);
                      }}
                    >
                      <Clock className="h-6 w-6" />
                      <span className="text-sm font-medium">View Timesheet</span>
                    </Button>

                    <Button variant="outline" className="flex-col h-24 gap-2" onClick={() => setLeaveSummaryOpen(true)}>
                      <CalendarDays className="h-6 w-6" />
                      <span className="text-sm font-medium">Leave Summary</span>
                    </Button>

                    <Button
                      variant="outline"
                      className="flex-col h-24 gap-2 text-destructive border-destructive/30 hover:bg-destructive/10"
                      onClick={() => {
                        handleDeactivate(clickedEmployee);
                        setClickedEmployee(null);
                      }}
                    >
                      <UserX className="h-6 w-6" />
                      <span className="text-sm font-medium">Deactivate</span>
                    </Button>
                  </>
                )}
              </div>

              {/* Team Section - shown below action buttons for managers/VP/admin */}
              {isManager && (
                <>
                  <Separator className="my-5" />

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold flex items-center gap-2">
                        <Users className="h-4 w-4 text-primary" />
                        {clickedEmployee.first_name}'s Team
                        {!loadingClickedTeam && (
                          <Badge variant="secondary" className="ml-1 font-normal">
                            {clickedEmployeeTeam.length} member{clickedEmployeeTeam.length !== 1 ? "s" : ""}
                          </Badge>
                        )}
                      </h4>
                      <Button size="sm" variant="outline" className="gap-1.5" onClick={handleManageTeam}>
                        <UserPlus className="h-3.5 w-3.5" />
                        Add to Team
                      </Button>
                    </div>

                    {loadingClickedTeam ? (
                      <div className="flex items-center justify-center py-6">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : clickedEmployeeTeam.length === 0 ? (
                      <div className="text-center py-6 text-muted-foreground bg-muted/30 rounded-lg">
                        <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
                        <p className="text-sm">No team members assigned</p>
                        <p className="text-xs mt-1">Click "Add to Team" to assign employees.</p>
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
                              <TableHead className="font-semibold text-xs w-[60px]"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {clickedEmployeeTeam.map((member) => {
                              const isSubManager = clickedTeamManagerIds.has(member.id);
                              return (
                                <TableRow
                                  key={member.id}
                                  className={cn(isSubManager && "cursor-pointer hover:bg-accent/50")}
                                  onClick={() => {
                                    if (isSubManager) openSubTeamFromClicked(member);
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
                                      {isSubManager && (
                                        <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto" />
                                      )}
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
                                  <TableCell className="py-2" onClick={(e) => e.stopPropagation()}>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                                      onClick={() => handleRemoveFromClickedTeam(member)}
                                      title="Remove from team"
                                    >
                                      <UserMinus className="h-3.5 w-3.5" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

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
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={goBackSubTeam}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
              <div>
                <DialogTitle className="font-display text-lg flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  {currentSubTeamName}'s Team
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
              <p className="text-sm">No team members under {currentSubTeamName}</p>
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
                    const isSubManager = clickedTeamManagerIds.has(member.id);
                    return (
                      <TableRow
                        key={member.id}
                        className={cn(isSubManager && "cursor-pointer hover:bg-accent/50")}
                        onClick={() => {
                          if (isSubManager) drillIntoSubTeam(member);
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

      {/* Dialogs */}

      {/* Leave Summary Dialog */}
      <Dialog open={leaveSummaryOpen} onOpenChange={setLeaveSummaryOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              Leave Summary — {clickedEmployee?.first_name} {clickedEmployee?.last_name}
              <span className="text-xs font-normal text-muted-foreground ml-1">
                (up to Jun 30, {new Date().getMonth() >= 6 ? new Date().getFullYear() + 1 : new Date().getFullYear()})
              </span>
            </DialogTitle>
          </DialogHeader>

          {loadingLeave ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : clickedLeaveBalances.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CalendarDays className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No leave data available</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 py-2">
              {clickedLeaveBalances.map((lb) => (
                <div key={lb.leave_type} className="border rounded-lg p-3 space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground truncate">{lb.leave_type}</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-lg font-bold text-foreground">{lb.remaining_days}</span>
                    <span className="text-xs text-muted-foreground">/ {lb.total_days} remaining</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1.5">
                    <div
                      className={cn(
                        "h-1.5 rounded-full transition-all",
                        lb.total_days > 0 && lb.used_days / lb.total_days > 0.8
                          ? "bg-destructive"
                          : lb.total_days > 0 && lb.used_days / lb.total_days > 0.5
                            ? "bg-yellow-500"
                            : "bg-primary",
                      )}
                      style={{
                        width: lb.total_days > 0 ? `${Math.min(100, (lb.used_days / lb.total_days) * 100)}%` : "0%",
                      }}
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">{lb.used_days} used</p>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AddEmployeeDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} onAdd={handleAddEmployee} />

      <EmployeeProfileDialog employee={selectedEmployee} open={profileOpen} onOpenChange={setProfileOpen} />

      <EditEmployeeDialog
        employee={selectedEmployee}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSave={handleSaveEmployee}
      />

      <TimesheetDialog employee={selectedEmployee} open={timesheetOpen} onOpenChange={setTimesheetOpen} />

      <DeactivateDialog
        employee={selectedEmployee}
        open={deactivateOpen}
        onOpenChange={setDeactivateOpen}
        onConfirm={handleConfirmDeactivate}
      />

      {/* Add to Team Dialog - for VP/admin managing another employee's team */}
      {managingEmployeeId && (
        <AddToTeamDialog
          open={manageTeamDialogOpen}
          onOpenChange={(open) => {
            setManageTeamDialogOpen(open);
            if (!open) setManagingEmployeeId(null);
          }}
          currentTeamMemberIds={clickedEmployeeTeam.map((m) => m.id)}
          onAdded={handleTeamMembersAdded}
          targetEmployeeId={managingEmployeeId}
        />
      )}

      {/* Header Request Promotion picker */}
      <Dialog open={promotionPickerOpen} onOpenChange={setPromotionPickerOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Select employee for promotion request</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Select value={promotionEmployeeId} onValueChange={setPromotionEmployeeId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose employee" />
              </SelectTrigger>
              <SelectContent>
                {employees.map((emp) => (
                  <SelectItem key={emp.id} value={String(emp.id)}>
                    {emp.first_name} {emp.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPromotionPickerOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleStartPromotionRequest}>Continue</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <RequestPromotionDialog
        open={promotionDialogOpen}
        onOpenChange={(open) => {
          setPromotionDialogOpen(open);
          if (!open) {
            setPromotionTarget(null);
          }
        }}
        employee={promotionTarget}
      />
    </DashboardLayout>
  );
};

export default Employees;
