import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Users, Clock, Mail, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { TeamMemberAttendanceDialog } from "./TeamMemberAttendanceDialog";

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
  const { user } = useAuth();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [attendanceDialogOpen, setAttendanceDialogOpen] = useState(false);

  const fetchTeamMembers = useCallback(async () => {
    if (!user) return;

    // Get the current user's employee ID
    const { data: employeeId } = await supabase.rpc('get_employee_id_for_user', {
      _user_id: user.id
    });

    if (employeeId) {
      const { data, error } = await supabase
        .from("employees")
        .select("id, first_name, last_name, email, department, job_title, location, status, hire_date")
        .eq("line_manager_id", employeeId)
        .order("first_name", { ascending: true });

      if (!error && data) {
        setTeamMembers(data);
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

  if (loading) {
    return null;
  }

  if (teamMembers.length === 0) {
    return null;
  }

  return (
    <>
      <Card className="mb-6 animate-fade-in">
        <CardHeader className="pb-3">
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            My Team ({teamMembers.length} members)
          </CardTitle>
        </CardHeader>
        <CardContent>
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
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => window.open(`mailto:${member.email}`, '_blank')}
                        >
                          <Mail className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <TeamMemberAttendanceDialog
        employee={selectedMember}
        open={attendanceDialogOpen}
        onOpenChange={setAttendanceDialogOpen}
      />
    </>
  );
}
