
DO $$
DECLARE
  r app_role;
  p text;
  new_perms text[] := ARRAY[
    'add_announcement', 'edit_announcement', 'delete_announcement', 'view_announcements',
    'manage_documents', 'approve_leave', 'view_reports', 'manage_payroll',
    'view_payroll', 'manage_onboarding', 'manage_tasks', 'view_tasks',
    'manage_loans', 'view_loans', 'manage_calendar', 'manage_support'
  ];
  roles app_role[] := ARRAY['vp'::app_role, 'admin'::app_role, 'manager'::app_role, 'line_manager'::app_role, 'employee'::app_role];
  default_val boolean;
BEGIN
  FOREACH r IN ARRAY roles LOOP
    FOREACH p IN ARRAY new_perms LOOP
      IF r IN ('vp', 'admin') THEN
        default_val := true;
      ELSIF r = 'manager' THEN
        default_val := p IN ('add_announcement', 'view_announcements', 'approve_leave', 'view_reports', 'manage_tasks', 'view_tasks', 'view_loans', 'manage_calendar');
      ELSIF r = 'line_manager' THEN
        default_val := p IN ('view_announcements', 'approve_leave', 'view_reports', 'view_tasks', 'view_loans');
      ELSE
        default_val := p IN ('view_announcements', 'view_tasks');
      END IF;
      
      INSERT INTO public.role_permissions (role, permission, enabled)
      VALUES (r, p, default_val)
      ON CONFLICT (role, permission) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;
