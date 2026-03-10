-- Grant view_onboarding permission to all roles
-- Employees can see their own onboarding progress

DO $$
DECLARE
  all_roles text[] := ARRAY['vp', 'admin', 'manager', 'line_manager', 'employee'];
  r text;
BEGIN
  FOREACH r IN ARRAY all_roles
  LOOP
    INSERT INTO public.role_permissions (role, permission, enabled)
    VALUES (r::app_role, 'view_onboarding', true)
    ON CONFLICT (role, permission) DO NOTHING;
  END LOOP;
END $$;
