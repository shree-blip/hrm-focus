
-- Seed new granular support permissions for all roles
DO $$
DECLARE
  new_perms text[] := ARRAY[
    'view_bug_reports',
    'view_grievances',
    'view_asset_requests'
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
