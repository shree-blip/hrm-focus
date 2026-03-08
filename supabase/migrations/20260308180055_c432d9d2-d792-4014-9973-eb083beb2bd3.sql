
-- Insert new module permissions for all roles
-- These permissions are enabled by default for all roles so existing users aren't locked out
-- CEO/Admin can then disable specific permissions per role or per user

-- New permissions to add
DO $$
DECLARE
  new_perms text[] := ARRAY[
    'view_own_attendance',
    'view_documents',
    'view_leave',
    'view_support',
    'view_invoices',
    'manage_invoices',
    'view_log_sheet',
    'view_performance'
  ];
  all_roles text[] := ARRAY['vp', 'admin', 'manager', 'line_manager', 'employee'];
  r text;
  p text;
BEGIN
  FOREACH r IN ARRAY all_roles
  LOOP
    FOREACH p IN ARRAY new_perms
    LOOP
      INSERT INTO public.role_permissions (role, permission, enabled)
      VALUES (r::app_role, p, true)
      ON CONFLICT (role, permission) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;
