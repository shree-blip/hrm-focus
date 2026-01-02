-- Enable realtime for user_roles, role_permissions, and user_permission_overrides tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_roles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.role_permissions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_permission_overrides;

-- Ensure REPLICA IDENTITY for proper realtime updates
ALTER TABLE public.user_roles REPLICA IDENTITY FULL;
ALTER TABLE public.role_permissions REPLICA IDENTITY FULL;
ALTER TABLE public.user_permission_overrides REPLICA IDENTITY FULL;