-- Step 2: Create permissions table
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role app_role NOT NULL,
  permission TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(role, permission)
);

-- Enable RLS
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- Only VP can manage permissions
CREATE POLICY "VP can manage permissions" ON public.role_permissions
FOR ALL USING (has_role(auth.uid(), 'vp'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can view permissions" ON public.role_permissions
FOR SELECT USING (auth.uid() IS NOT NULL);

-- Create user-specific permission overrides
CREATE TABLE IF NOT EXISTS public.user_permission_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission TEXT NOT NULL,
  enabled BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, permission)
);

ALTER TABLE public.user_permission_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "VP can manage user overrides" ON public.user_permission_overrides
FOR ALL USING (has_role(auth.uid(), 'vp'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view own overrides" ON public.user_permission_overrides
FOR SELECT USING (auth.uid() = user_id);

-- Add triggers for updated_at
CREATE TRIGGER update_role_permissions_updated_at
BEFORE UPDATE ON public.role_permissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_permission_overrides_updated_at
BEFORE UPDATE ON public.user_permission_overrides
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to check if user has a specific permission
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role app_role;
  role_enabled boolean;
  override_enabled boolean;
BEGIN
  -- Get user's role
  SELECT role INTO user_role FROM user_roles WHERE user_id = _user_id LIMIT 1;
  
  IF user_role IS NULL THEN
    RETURN false;
  END IF;
  
  -- Check for user-specific override first
  SELECT enabled INTO override_enabled 
  FROM user_permission_overrides 
  WHERE user_id = _user_id AND permission = _permission;
  
  IF override_enabled IS NOT NULL THEN
    RETURN override_enabled;
  END IF;
  
  -- Fall back to role-based permission
  SELECT enabled INTO role_enabled 
  FROM role_permissions 
  WHERE role = user_role AND permission = _permission;
  
  RETURN COALESCE(role_enabled, false);
END;
$$;

-- Create function to get employees visible to a user
CREATE OR REPLACE FUNCTION public.get_visible_employee_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_employee_id uuid;
BEGIN
  -- If user has view_employees_all permission, return all
  IF has_permission(_user_id, 'view_employees_all') THEN
    RETURN QUERY SELECT id FROM employees WHERE status = 'active';
    RETURN;
  END IF;
  
  -- Get the user's employee record
  SELECT e.id INTO user_employee_id
  FROM employees e
  JOIN profiles p ON e.profile_id = p.id
  WHERE p.user_id = _user_id;
  
  -- If user has view_employees_reports_only, return their reports
  IF has_permission(_user_id, 'view_employees_reports_only') THEN
    RETURN QUERY 
    SELECT id FROM employees 
    WHERE status = 'active' 
      AND (line_manager_id = user_employee_id OR manager_id = user_employee_id);
    RETURN;
  END IF;
  
  -- Otherwise return empty
  RETURN;
END;
$$;

-- Update RLS policy for attendance_logs
DROP POLICY IF EXISTS "Line managers can view team attendance" ON public.attendance_logs;
CREATE POLICY "Permission-based attendance view" ON public.attendance_logs
FOR SELECT USING (
  auth.uid() = user_id OR
  has_permission(auth.uid(), 'view_attendance_all') OR
  (has_permission(auth.uid(), 'view_attendance_reports_only') AND 
   employee_id IN (SELECT get_visible_employee_ids(auth.uid())))
);