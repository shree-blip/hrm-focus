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
  profile_id: string | null;
  manager_id: string | null;
  line_manager_id: string | null;
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

  const fetchEmployees = useCallback(async () => {
    if (isManager) {
      // Managers use the secure salary view - only shows salaries for direct reports, admins, and VPs
      const { data, error } = await supabase
        .from("employee_salary_view")
        .select("*")
        .order("first_name", { ascending: true });

      if (!error && data) {
        setEmployees(data as Employee[]);
      }
    } else {
      // Regular employees use the directory view (no sensitive data)
      const { data, error } = await supabase
        .from("employee_directory")
        .select("*")
        .order("first_name", { ascending: true });

      if (!error && data) {
        // Map directory data to Employee interface with null sensitive fields
        const mapped: Employee[] = (data as EmployeeDirectory[]).map(emp => ({
          id: emp.id || '',
          employee_id: null,
          first_name: emp.first_name || '',
          last_name: emp.last_name || '',
          email: emp.email || '',
          phone: null,
          department: emp.department,
          job_title: emp.job_title,
          location: emp.location,
          status: emp.status,
          hire_date: emp.hire_date,
          pay_type: null,
          salary: null,
          hourly_rate: null,
          profile_id: emp.profile_id,
          manager_id: emp.manager_id,
          line_manager_id: emp.line_manager_id,
        }));
        setEmployees(mapped);
      }
    }
    setLoading(false);
  }, [isManager]);

  useEffect(() => {
    fetchEmployees();

    // Set up realtime subscription
    const employeesChannel = supabase
      .channel('employees-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'employees' },
        () => fetchEmployees()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(employeesChannel);
    };
  }, [fetchEmployees]);

  const createEmployee = async (employee: Omit<Employee, "id">) => {
    if (!isManager) {
      toast({ title: "Unauthorized", description: "You don't have permission to add employees.", variant: "destructive" });
      return null;
    }

    const { data, error } = await supabase
      .from("employees")
      .insert(employee)
      .select()
      .single();

    if (error) {
      toast({ title: "Error", description: "Failed to add employee", variant: "destructive" });
      return null;
    } else {
      toast({ title: "Employee Added", description: `${employee.first_name} ${employee.last_name} has been added.` });
      fetchEmployees();
      return data as Employee;
    }
  };

  const updateEmployee = async (employeeId: string, updates: Partial<Employee>) => {
    if (!isManager) {
      toast({ title: "Unauthorized", description: "You don't have permission to edit employees.", variant: "destructive" });
      return;
    }

    const { error } = await supabase
      .from("employees")
      .update(updates)
      .eq("id", employeeId);

    if (error) {
      toast({ title: "Error", description: "Failed to update employee", variant: "destructive" });
    } else {
      toast({ title: "Employee Updated", description: "Changes saved successfully." });
      fetchEmployees();
    }
  };

  const deactivateEmployee = async (employeeId: string) => {
    if (!isManager) {
      toast({ title: "Unauthorized", description: "You don't have permission to deactivate employees.", variant: "destructive" });
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
      fetchEmployees();
    }
  };

  return {
    employees,
    loading,
    createEmployee,
    updateEmployee,
    deactivateEmployee,
    refetch: fetchEmployees,
  };
}
