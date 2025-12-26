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
}

export function useEmployees() {
  const { user, isManager } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEmployees = useCallback(async () => {
    const { data, error } = await supabase
      .from("employees")
      .select("*")
      .order("first_name", { ascending: true });

    if (!error && data) {
      setEmployees(data as Employee[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchEmployees();
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
