import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

interface Employee {
  id: string;
  employee_id: string | null;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  department: string | null;
  job_title: string | null;
  location: string | null;
  status: string | null;
  hire_date: string | null;
  pay_type: string | null;
  salary: number | null;
  hourly_rate: number | null;
  income_tax: number | null;
  social_security: number | null;
  provident_fund: number | null;
  profile_id: string | null;
  user_id: string | null;
  manager_id: string | null;
  line_manager_id: string | null;
  gender: string | null;
  insurance_premium: number | null;
  include_dashain_bonus: boolean | null;
  profiles?: {
    avatar_url: string | null;
  };
  avatar_url?: string | null;
}

// Directory view interface (no sensitive data)
interface EmployeeDirectory {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  department: string | null;
  job_title: string | null;
  location: string | null;
  status: string | null;
  hire_date: string | null;
  manager_id: string | null;
  line_manager_id: string | null;
  profile_id: string | null;
}

export function useEmployees() {
  const { user, isManager } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasFetched, setHasFetched] = useState(false);

  const fetchEmployees = useCallback(
    async (force = false) => {
      if (hasFetched && !force) return;

      // Fetch profiles to get user_id mapping AND avatar_url
      const { data: profilesData } = await supabase.from("profiles").select("id, user_id, avatar_url");

      const profileToUserMap = new Map((profilesData || []).map((p) => [p.id, p.user_id]));

      // ✅ Map profile_id to avatar_url
      const profileToAvatarMap = new Map((profilesData || []).map((p) => [p.id, p.avatar_url]));

      if (isManager) {
        // Managers use the secure salary view - only shows salaries for direct reports, admins, and VPs
        const { data, error } = await supabase
          .from("employee_salary_view")
          .select("*")
          .order("first_name", { ascending: true });

        if (!error && data) {
          const employeesWithUserId = data.map((emp) => ({
            ...emp,
            user_id: emp.profile_id ? profileToUserMap.get(emp.profile_id) || null : null,
            gender: (emp as any).gender || null,
            insurance_premium: (emp as any).insurance_premium || null,
            include_dashain_bonus: (emp as any).include_dashain_bonus ?? null,
            profiles: emp.profile_id
              ? { avatar_url: profileToAvatarMap.get(emp.profile_id) || null }
              : undefined,
            avatar_url: emp.profile_id ? profileToAvatarMap.get(emp.profile_id) || null : null,
          }));
          setEmployees(employeesWithUserId as Employee[]);
        }
      } else {
        // Regular employees use the directory view (no sensitive data)
        const { data, error } = await supabase
          .from("employee_directory")
          .select("*")
          .order("first_name", { ascending: true });

        if (!error && data) {
          // Map directory data to Employee interface with null sensitive fields
          const mapped: Employee[] = (data as EmployeeDirectory[]).map((emp) => ({
            id: emp.id || "",
            employee_id: null,
            first_name: emp.first_name || "",
            last_name: emp.last_name || "",
            email: emp.email || "",
            phone: null,
            department: emp.department,
            job_title: emp.job_title,
            location: emp.location,
            status: emp.status,
            hire_date: emp.hire_date,
            pay_type: null,
            salary: null,
            hourly_rate: null,
            income_tax: null,
            social_security: null,
            provident_fund: null,
            profile_id: emp.profile_id,
            user_id: emp.profile_id ? profileToUserMap.get(emp.profile_id) || null : null,
            manager_id: emp.manager_id,
            line_manager_id: emp.line_manager_id,
            gender: null,
            insurance_premium: null,
            include_dashain_bonus: null,
            profiles: emp.profile_id
              ? { avatar_url: profileToAvatarMap.get(emp.profile_id) || null }
              : undefined,
            avatar_url: emp.profile_id ? profileToAvatarMap.get(emp.profile_id) || null : null,
          }));
          setEmployees(mapped);
        }
      }
      setLoading(false);
      setHasFetched(true);
    },
    [isManager, hasFetched],
  );

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  // ✅ Set up realtime subscription for both employees AND profiles changes
  useEffect(() => {
    const employeesChannel = supabase
      .channel("employees-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "employees" },
        () => fetchEmployees(true), // Force refetch on realtime changes
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        () => fetchEmployees(true), // ✅ Also refetch when profiles change (avatar updates)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(employeesChannel);
    };
  }, []);

  const createEmployee = async (employee: Omit<Employee, "id">) => {
    if (!isManager) {
      toast({
        title: "Unauthorized",
        description: "You don't have permission to add employees.",
        variant: "destructive",
      });
      return null;
    }

    const { data, error } = await supabase.from("employees").insert(employee).select().single();

    if (error) {
      toast({ title: "Error", description: "Failed to add employee", variant: "destructive" });
      return null;
    } else {
      toast({ title: "Employee Added", description: `${employee.first_name} ${employee.last_name} has been added.` });
      fetchEmployees(true);
      return { ...data, user_id: null } as Employee;
    }
  };

  const updateEmployee = async (employeeId: string, updates: Partial<Employee>) => {
    if (!isManager) {
      toast({
        title: "Unauthorized",
        description: "You don't have permission to edit employees.",
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase.from("employees").update(updates).eq("id", employeeId);

    if (error) {
      toast({ title: "Error", description: "Failed to update employee", variant: "destructive" });
    } else {
      toast({ title: "Employee Updated", description: "Changes saved successfully." });
      fetchEmployees(true);
    }
  };

  const deactivateEmployee = async (employeeId: string) => {
    if (!isManager) {
      toast({
        title: "Unauthorized",
        description: "You don't have permission to deactivate employees.",
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase
      .from("employees")
      .update({ status: "inactive", termination_date: new Date().toISOString().split("T")[0] })
      .eq("id", employeeId);

    if (error) {
      toast({ title: "Error", description: "Failed to deactivate employee", variant: "destructive" });
    } else {
      toast({ title: "Employee Deactivated", description: "Employee has been deactivated." });
      fetchEmployees(true);
    }
  };

  return {
    employees,
    loading,
    createEmployee,
    updateEmployee,
    deactivateEmployee,
    refetch: () => fetchEmployees(true),
  };
}
