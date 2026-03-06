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
  | 'manage_salaries_all'
  | 'add_announcement'
  | 'edit_announcement'
  | 'delete_announcement'
  | 'view_announcements'
  | 'manage_documents'
  | 'approve_leave'
  | 'view_reports'
  | 'manage_payroll'
  | 'view_payroll'
  | 'manage_onboarding'
  | 'manage_tasks'
  | 'view_tasks'
  | 'manage_loans'
  | 'view_loans'
  | 'manage_calendar'
  | 'manage_support';

export const PERMISSION_LABELS: Record<Permission, string> = {
  manage_access: 'Manage Access Control',
  manage_employees: 'Manage Employees',
  manage_line_managers: 'Manage Line Managers',
  view_employees_all: 'View All Employees',
  view_employees_reports_only: 'View Reports Only',
  view_attendance_all: 'View All Attendance',
  view_attendance_reports_only: 'View Reports Attendance',
  manage_salaries_all: 'Manage Salaries',
  add_announcement: 'Add Announcement',
  edit_announcement: 'Edit Announcement',
  delete_announcement: 'Delete Announcement',
  view_announcements: 'View Announcements',
  manage_documents: 'Manage Documents',
  approve_leave: 'Approve Leave',
  view_reports: 'View Reports',
  manage_payroll: 'Manage Payroll',
  view_payroll: 'View Payroll',
  manage_onboarding: 'Manage Onboarding',
  manage_tasks: 'Manage Tasks',
  view_tasks: 'View Tasks',
  manage_loans: 'Manage Loans',
  view_loans: 'View Loans',
  manage_calendar: 'Manage Calendar',
  manage_support: 'Manage Support',
};

export const PERMISSION_CATEGORIES: Record<string, Permission[]> = {
  'Access & Users': ['manage_access', 'manage_employees', 'manage_line_managers', 'view_employees_all', 'view_employees_reports_only'],
  'Attendance': ['view_attendance_all', 'view_attendance_reports_only'],
  'Announcements': ['add_announcement', 'edit_announcement', 'delete_announcement', 'view_announcements'],
  'Documents & Reports': ['manage_documents', 'view_reports'],
  'Leave & Payroll': ['approve_leave', 'manage_payroll', 'view_payroll', 'manage_salaries_all'],
  'Tasks & Operations': ['manage_tasks', 'view_tasks', 'manage_loans', 'view_loans', 'manage_calendar', 'manage_onboarding', 'manage_support'],
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
  'add_announcement',
  'edit_announcement',
  'delete_announcement',
  'view_announcements',
  'manage_documents',
  'approve_leave',
  'view_reports',
  'manage_payroll',
  'view_payroll',
  'manage_onboarding',
  'manage_tasks',
  'view_tasks',
  'manage_loans',
  'view_loans',
  'manage_calendar',
  'manage_support',
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
