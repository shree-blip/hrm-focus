
-- Seed edit_attendance permission for all roles
INSERT INTO public.role_permissions (role, permission, enabled)
VALUES 
  ('vp', 'edit_attendance', true),
  ('admin', 'edit_attendance', true),
  ('manager', 'edit_attendance', false),
  ('line_manager', 'edit_attendance', false),
  ('supervisor', 'edit_attendance', false),
  ('employee', 'edit_attendance', false)
ON CONFLICT (role, permission) DO NOTHING;
