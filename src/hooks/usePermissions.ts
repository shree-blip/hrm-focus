import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type Permission = 
  | 'manage_access'
  | 'manage_employees'
  | 'manage_line_managers'
  | 'view_employees_all'
  | 'view_employees_reports_only'
  | 'view_attendance_all'
  | 'view_attendance_reports_only'
  | 'manage_salaries_all';

export const PERMISSION_LABELS: Record<Permission, string> = {
  manage_access: 'Manage Access Control',
  manage_employees: 'Manage Employees',
  manage_line_managers: 'Manage Line Managers',
  view_employees_all: 'View All Employees',
  view_employees_reports_only: 'View Reports Only',
  view_attendance_all: 'View All Attendance',
  view_attendance_reports_only: 'View Reports Attendance',
  manage_salaries_all: 'Manage Salaries',
};

export const ALL_PERMISSIONS: Permission[] = [
  'manage_access',
  'manage_employees',
  'manage_line_managers',
  'view_employees_all',
  'view_employees_reports_only',
  'view_attendance_all',
  'view_attendance_reports_only',
  'manage_salaries_all',
];

interface RolePermission {
  role: string;
  permission: string;
  enabled: boolean;
}

export function usePermissions() {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<Record<Permission, boolean>>({} as Record<Permission, boolean>);
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUserPermissions = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    // Fetch all permissions for the user using the has_permission function
    const permissionResults: Record<Permission, boolean> = {} as Record<Permission, boolean>;
    
    for (const perm of ALL_PERMISSIONS) {
      const { data } = await supabase.rpc('has_permission', {
        _user_id: user.id,
        _permission: perm
      });
      permissionResults[perm] = !!data;
    }
    
    setPermissions(permissionResults);
    setLoading(false);
  }, [user]);

  const fetchRolePermissions = useCallback(async () => {
    const { data, error } = await supabase
      .from('role_permissions')
      .select('role, permission, enabled')
      .order('role');
    
    if (!error && data) {
      setRolePermissions(data);
    }
  }, []);

  useEffect(() => {
    fetchUserPermissions();
    fetchRolePermissions();
  }, [fetchUserPermissions, fetchRolePermissions]);

  const hasPermission = (permission: Permission): boolean => {
    return permissions[permission] ?? false;
  };

  const updateRolePermission = async (role: string, permission: string, enabled: boolean) => {
    const { error } = await supabase
      .from('role_permissions')
      .update({ enabled })
      .eq('role', role as any)
      .eq('permission', permission);
    
    if (!error) {
      await fetchRolePermissions();
    }
    return !error;
  };

  return {
    permissions,
    rolePermissions,
    loading,
    hasPermission,
    updateRolePermission,
    refetch: fetchRolePermissions,
  };
}
