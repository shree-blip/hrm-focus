import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { resolveTeamMemberUserIds } from "@/utils/teamResolver";

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

interface AttendanceLog {
  id: string;
  clock_in: string;
  clock_out: string | null;
  clock_type: string | null;
  total_break_minutes: number | null;
  notes: string | null;
  status: string | null;
}

export function useLineManagerAccess() {
  const { user, profile, isVP } = useAuth();
  const [isLineManager, setIsLineManager] = useState(false);
  const [canCreateEmployee, setCanCreateEmployee] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAccess = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      // Check if user is a line manager
      const { data: lineManagerCheck } = await supabase.rpc('is_line_manager', {
        _user_id: user.id
      });
      setIsLineManager(!!lineManagerCheck);

      // Check if user can create employees
      const { data: createCheck } = await supabase.rpc('can_create_employee', {
        _user_id: user.id
      });
      setCanCreateEmployee(!!createCheck);

      setLoading(false);
    };

    checkAccess();
  }, [user]);

  const fetchTeamMembers = useCallback(async () => {
    if (!user) return;

    // If VP, they see all employees via the main useEmployees hook
    // Line managers only see their direct reports (from junction table + legacy fields)
    if (isLineManager && !isVP) {
      const teamUserIds = await resolveTeamMemberUserIds(user.id);

      if (teamUserIds.length > 0) {
        // Get employee IDs from user IDs
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, user_id")
          .in("user_id", teamUserIds);

        if (profiles && profiles.length > 0) {
          const profileIds = profiles.map((p) => p.id);
          const { data, error } = await supabase
            .from("employees")
            .select("id, first_name, last_name, email, department, job_title, location, status, hire_date")
            .in("profile_id", profileIds)
            .order("first_name", { ascending: true });

          if (!error && data) {
            setTeamMembers(data);
            return;
          }
        }
      }

      // Also check legacy field directly as fallback
      const { data: employeeId } = await supabase.rpc('get_employee_id_for_user', {
        _user_id: user.id
      });

      if (employeeId) {
        const { data, error } = await supabase
          .from("employees")
          .select("id, first_name, last_name, email, department, job_title, location, status, hire_date")
          .or(`line_manager_id.eq.${employeeId},manager_id.eq.${employeeId}`)
          .order("first_name", { ascending: true });

        if (!error && data) {
          setTeamMembers(data);
        }
      }
    }
  }, [user, isLineManager, isVP]);

  useEffect(() => {
    if (isLineManager) {
      fetchTeamMembers();
    }
  }, [isLineManager, fetchTeamMembers]);

  const fetchTeamMemberAttendance = async (employeeId: string, startDate: Date, endDate: Date): Promise<AttendanceLog[]> => {
    const { data, error } = await supabase
      .from("attendance_logs")
      .select("id, clock_in, clock_out, clock_type, total_break_minutes, notes, status")
      .eq("employee_id", employeeId)
      .gte("clock_in", startDate.toISOString())
      .lte("clock_in", endDate.toISOString())
      .order("clock_in", { ascending: false });

    if (error) {
      console.error("Error fetching team member attendance:", error);
      return [];
    }

    return data || [];
  };

  return {
    isLineManager,
    canCreateEmployee,
    teamMembers,
    loading,
    fetchTeamMembers,
    fetchTeamMemberAttendance,
  };
}
