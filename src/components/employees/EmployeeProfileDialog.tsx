import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Mail, Phone, MapPin, Building, Briefcase, Users, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

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

interface EmployeeProfileDialogProps {
  employee: Employee | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EmployeeProfileDialog({ employee, open, onOpenChange }: EmployeeProfileDialogProps) {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(false);

  useEffect(() => {
    if (open && employee?.id) {
      fetchTeamForEmployee(String(employee.id));
    } else {
      setTeamMembers([]);
    }
  }, [open, employee?.id]);

  const fetchTeamForEmployee = async (employeeId: string) => {
    setLoadingTeam(true);
    try {
      // Fetch employees where this person is the line_manager or manager
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

      const allReports = [...(lineReports || []), ...(managerReports || [])];
      const uniqueReports = allReports.filter((emp, index, self) => self.findIndex((e) => e.id === emp.id) === index);
      uniqueReports.sort((a, b) => a.first_name.localeCompare(b.first_name));
      setTeamMembers(uniqueReports);
    } catch (err) {
      console.error("Failed to fetch team members:", err);
      setTeamMembers([]);
    }
    setLoadingTeam(false);
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase();
  };

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

          {/* Team Section - Only shown if this employee has team members */}
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
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  Team Members ({teamMembers.length})
                </h4>
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
                      {teamMembers.map((member) => (
                        <TableRow key={member.id}>
                          <TableCell className="py-2">
                            <div className="flex items-center gap-2">
                              <Avatar className="h-7 w-7">
                                <AvatarFallback className="bg-primary/10 text-primary font-medium text-xs">
                                  {getInitials(member.first_name, member.last_name)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium text-sm">
                                  {member.first_name} {member.last_name}
                                </p>
                                <p className="text-xs text-muted-foreground">{member.email}</p>
                              </div>
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
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
