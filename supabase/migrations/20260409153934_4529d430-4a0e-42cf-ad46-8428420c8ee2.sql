-- Remove unused manage_line_managers permission from role_permissions
DELETE FROM public.role_permissions WHERE permission = 'manage_line_managers';

-- Remove any user overrides for this unused permission
DELETE FROM public.user_permission_overrides WHERE permission = 'manage_line_managers';