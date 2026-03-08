import { useState, useEffect, useCallback, useMemo } from "react";
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
  | 'view_own_attendance'
  | 'manage_salaries_all'
  | 'add_announcement'
  | 'edit_announcement'
  | 'delete_announcement'
  | 'view_announcements'
  | 'manage_documents'
  | 'view_documents'
  | 'approve_leave'
  | 'view_leave'
  | 'view_reports'
  | 'manage_payroll'
  | 'view_payroll'
  | 'manage_onboarding'
  | 'manage_tasks'
  | 'view_tasks'
  | 'manage_loans'
  | 'view_loans'
  | 'manage_calendar'
  | 'manage_support'
  | 'view_support'
  | 'view_invoices'
  | 'manage_invoices'
  | 'view_log_sheet'
  | 'view_performance';

export const PERMISSION_LABELS: Record<Permission, string> = {
  manage_access: 'Manage Access Control',
  manage_employees: 'Manage Employees',
  manage_line_managers: 'Manage Line Managers',
  view_employees_all: 'View All Employees',
  view_employees_reports_only: 'View Reports Only',
  view_attendance_all: 'View All Attendance',
  view_attendance_reports_only: 'View Reports Attendance',
  view_own_attendance: 'View Own Attendance',
  manage_salaries_all: 'Manage Salaries',
  add_announcement: 'Add Announcement',
  edit_announcement: 'Edit Announcement',
  delete_announcement: 'Delete Announcement',
  view_announcements: 'View Announcements',
  manage_documents: 'Manage Documents',
  view_documents: 'View Documents',
  approve_leave: 'Approve Leave',
  view_leave: 'View Leave',
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
  view_support: 'View Support',
  view_invoices: 'View Invoices',
  manage_invoices: 'Manage Invoices',
  view_log_sheet: 'View Log Sheet',
  view_performance: 'View Performance',
};

export const PERMISSION_CATEGORIES: Record<string, Permission[]> = {
  'Access & Users': ['manage_access', 'manage_employees', 'manage_line_managers', 'view_employees_all', 'view_employees_reports_only'],
  'Attendance': ['view_attendance_all', 'view_attendance_reports_only'],
  'Announcements': ['add_announcement', 'edit_announcement', 'delete_announcement', 'view_announcements'],
  'Documents & Reports': ['manage_documents', 'view_reports'],
  'Leave & Payroll': ['approve_leave', 'manage_payroll', 'view_payroll', 'manage_salaries_all'],
  'Tasks & Operations': ['manage_tasks', 'view_tasks', 'manage_loans', 'view_loans', 'manage_calendar', 'manage_onboarding', 'manage_support'],
};

export const ALL_PERMISSIONS: Permission[] = Object.values(PERMISSION_CATEGORIES).flat();

/**
 * Maps a permission key to the sidebar route it unlocks.
 * Used by sidebar to show/hide menu items based on effective permissions.
 */
export const PERMISSION_ROUTE_MAP: Record<string, Permission[]> = {
  '/announcements': ['add_announcement', 'edit_announcement', 'delete_announcement', 'view_announcements'],
  '/employees': ['manage_employees', 'view_employees_all', 'view_employees_reports_only'],
  '/approvals': ['approve_leave'],
  '/reports': ['view_reports'],
  '/payroll': ['manage_payroll', 'view_payroll'],
  '/onboarding': ['manage_onboarding'],
  '/access-control': ['manage_access'],
  '/attendance': ['view_attendance_all', 'view_attendance_reports_only'],
  '/documents': ['manage_documents'],
  '/loans': ['manage_loans', 'view_loans'],
  '/tasks': ['manage_tasks', 'view_tasks'],
  '/support': ['manage_support'],
};

interface RolePermission {
  role: string;
  permission: string;
  enabled: boolean;
}

export function usePermissions() {
  const { user, role } = useAuth();
  const [userOverrides, setUserOverrides] = useState<Record<string, boolean>>({});
  const [rolePermissionsForUser, setRolePermissionsForUser] = useState<Record<string, boolean>>({});
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);
  const [loading, setLoading] = useState(true);

  // Batch-fetch user's role permissions + overrides in parallel
  const fetchEffectivePermissions = useCallback(async () => {
    if (!user || !role) {
      setLoading(false);
      return;
    }

    // Fetch role permissions for user's role AND user overrides in parallel
    const [roleResult, overrideResult] = await Promise.all([
      supabase
        .from('role_permissions')
        .select('permission, enabled')
        .eq('role', role as any),
      supabase
        .from('user_permission_overrides')
        .select('permission, enabled')
        .eq('user_id', user.id),
    ]);

    const rolePerm: Record<string, boolean> = {};
    if (!roleResult.error && roleResult.data) {
      roleResult.data.forEach((rp) => {
        rolePerm[rp.permission] = rp.enabled;
      });
    }
    setRolePermissionsForUser(rolePerm);

    const overrides: Record<string, boolean> = {};
    if (!overrideResult.error && overrideResult.data) {
      overrideResult.data.forEach((o) => {
        overrides[o.permission] = o.enabled;
      });
    }
    setUserOverrides(overrides);
    setLoading(false);
  }, [user, role]);

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
    fetchEffectivePermissions();
    fetchRolePermissions();
  }, [fetchEffectivePermissions, fetchRolePermissions]);

  // Listen for realtime changes to re-fetch
  useEffect(() => {
    if (!user) return;

    const overridesChannel = supabase
      .channel('my-overrides')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_permission_overrides',
        filter: `user_id=eq.${user.id}`,
      }, () => {
        fetchEffectivePermissions();
      })
      .subscribe();

    const rolePermChannel = supabase
      .channel('role-perms-change')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'role_permissions',
      }, () => {
        fetchEffectivePermissions();
        fetchRolePermissions();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(overridesChannel);
      supabase.removeChannel(rolePermChannel);
    };
  }, [user, fetchEffectivePermissions, fetchRolePermissions]);

  /**
   * Effective permission check:
   * 1. If user_permission_overrides has an entry → use that
   * 2. Else fall back to role_permissions default
   */
  const permissions = useMemo(() => {
    const result: Record<Permission, boolean> = {} as Record<Permission, boolean>;
    for (const perm of ALL_PERMISSIONS) {
      if (perm in userOverrides) {
        result[perm] = userOverrides[perm];
      } else {
        result[perm] = rolePermissionsForUser[perm] ?? false;
      }
    }
    return result;
  }, [userOverrides, rolePermissionsForUser]);

  const hasPermission = useCallback((permission: Permission): boolean => {
    return permissions[permission] ?? false;
  }, [permissions]);

  /**
   * Check if user has access to a route based on any matching permission
   */
  const hasRouteAccess = useCallback((route: string): boolean => {
    const requiredPerms = PERMISSION_ROUTE_MAP[route];
    if (!requiredPerms) return true; // No permission mapping = accessible to all
    return requiredPerms.some((p) => permissions[p]);
  }, [permissions]);

  const updateRolePermission = async (r: string, permission: string, enabled: boolean) => {
    const { error } = await supabase
      .from('role_permissions')
      .update({ enabled })
      .eq('role', r as any)
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
    hasRouteAccess,
    updateRolePermission,
    refetch: fetchRolePermissions,
    refetchEffective: fetchEffectivePermissions,
  };
}
