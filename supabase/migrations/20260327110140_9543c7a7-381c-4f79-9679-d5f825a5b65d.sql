
-- Ensure no users have 'manager' role (migrate to supervisor)
UPDATE public.user_roles SET role = 'supervisor' WHERE role = 'manager';

-- Merge manager permissions into supervisor
INSERT INTO public.role_permissions (role, permission, enabled)
SELECT 'supervisor', rp.permission, rp.enabled
FROM public.role_permissions rp
WHERE rp.role = 'manager'
AND NOT EXISTS (
  SELECT 1 FROM public.role_permissions rp2
  WHERE rp2.role = 'supervisor' AND rp2.permission = rp.permission
)
ON CONFLICT DO NOTHING;

DELETE FROM public.role_permissions WHERE role = 'manager';

-- Update functions that grant 'manager' role privileges to use 'supervisor'
CREATE OR REPLACE FUNCTION public.get_management_user_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT user_id FROM public.user_roles WHERE role IN ('supervisor', 'admin', 'vp') $$;

CREATE OR REPLACE FUNCTION public.can_manage_announcements(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT (
  has_role(_user_id, 'admin'::app_role) OR has_role(_user_id, 'vp'::app_role)
  OR has_role(_user_id, 'supervisor'::app_role)
  OR EXISTS (SELECT 1 FROM announcement_publishers WHERE user_id = _user_id)
) $$;

CREATE OR REPLACE FUNCTION public.can_manage_task(_task_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT EXISTS (
  SELECT 1 FROM public.tasks t WHERE t.id = _task_id AND (
    t.created_by = _user_id
    OR public.has_role(_user_id, 'admin'::public.app_role)
    OR public.has_role(_user_id, 'vp'::public.app_role)
    OR public.has_role(_user_id, 'supervisor'::public.app_role)
  )
) $$;
