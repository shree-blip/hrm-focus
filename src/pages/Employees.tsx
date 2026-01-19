import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Search, Plus, Filter, MoreHorizontal, Mail, MapPin, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmployeeProfileDialog } from "@/components/employees/EmployeeProfileDialog";
import { EditEmployeeDialog } from "@/components/employees/EditEmployeeDialog";
import { TimesheetDialog } from "@/components/employees/TimesheetDialog";
import { DeactivateDialog } from "@/components/employees/DeactivateDialog";
import { AddEmployeeDialog } from "@/components/employees/AddEmployeeDialog";
import { useEmployees } from "@/hooks/useEmployees";
import { useAuth } from "@/contexts/AuthContext";
import { MyTeamSection } from "@/components/employees/MyTeamSection";
import { useAvatarUrl } from "@/hooks/useAvatarUrl";

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
  const { isManager, isVP, isLineManager, canCreateEmployee } = useAuth();

  const [searchQuery, setSearchQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");

  // Dialog states
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<any | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [timesheetOpen, setTimesheetOpen] = useState(false);
  const [deactivateOpen, setDeactivateOpen] = useState(false);

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase();
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
    managerId: string | null;
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
        manager_id: data.managerId,
        line_manager_id: data.lineManagerId,
      };

      const res: any = await createEmployee(payload as any);

      if (res?.error) throw res.error;

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
            {isManager ? "Employees" : "Employee Directory"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {isManager ? "Manage your team members and their roles" : "View your colleagues"}
          </p>
        </div>
        {canCreateEmployee && (
          <Button className="gap-2 shadow-md" onClick={() => setAddDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            Add Employee
          </Button>
        )}
      </div>

      {/* My Team Section - for Line Managers */}
      {isLineManager && !isVP && <MyTeamSection />}

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
          <SelectTrigger className="w-[180px]">
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
          <SelectTrigger className="w-[140px]">
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
              <TableHead className="font-semibold">Contact</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {filteredEmployees.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No employees found
                </TableCell>
              </TableRow>
            ) : (
              filteredEmployees.map((employee, index) => (
                <TableRow
                  key={employee.id}
                  className="group cursor-pointer animate-fade-in"
                  style={{ animationDelay: `${300 + index * 50}ms` }}
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
                    <div className="flex items-center font-bold gap-2">{employee.location === "US" ? " US" : "NP"}</div>
                  </TableCell>

                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn(
                        employee.status === "active" && "border-success/50 text-success bg-success/10",
                        employee.status === "probation" && "border-warning/50 text-warning bg-warning/10",
                        employee.status === "inactive" && "border-destructive/50 text-destructive bg-destructive/10",
                      )}
                    >
                      {employee.status || "active"}
                    </Badge>
                  </TableCell>

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

                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>

                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleViewProfile(employee)}>View Profile</DropdownMenuItem>

                        {isManager && (
                          <>
                            <DropdownMenuItem onClick={() => handleEditDetails(employee)}>
                              Edit Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleViewTimesheet(employee)}>
                              View Timesheet
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => handleDeactivate(employee)}>
                              Deactivate
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
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

      {/* Dialogs */}
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
    </DashboardLayout>
  );
};

export default Employees;
