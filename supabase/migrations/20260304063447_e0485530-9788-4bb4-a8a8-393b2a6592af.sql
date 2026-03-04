
-- 1. Create a safe upsert function for role changes (prevents duplicate key errors)
CREATE OR REPLACE FUNCTION public.change_user_role(_target_user_id uuid, _new_role app_role)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Delete all existing roles for this user, then insert the new one
  -- This ensures exactly one active role per user
  DELETE FROM public.user_roles WHERE user_id = _target_user_id;
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_target_user_id, _new_role);
  
  RETURN true;
END;
$$;

-- 2. Create an idempotent team member add function
CREATE OR REPLACE FUNCTION public.add_team_member(_manager_employee_id uuid, _member_employee_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_current_manager uuid;
  v_member_name text;
  v_manager_name text;
BEGIN
  -- Get member name
  SELECT first_name || ' ' || last_name INTO v_member_name
  FROM public.employees WHERE id = _member_employee_id;
  
  IF v_member_name IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'employee_not_found');
  END IF;
  
  -- Get manager name
  SELECT first_name || ' ' || last_name INTO v_manager_name
  FROM public.employees WHERE id = _manager_employee_id;
  
  -- Check if already assigned to this manager
  SELECT line_manager_id INTO v_current_manager
  FROM public.employees WHERE id = _member_employee_id;
  
  IF v_current_manager = _manager_employee_id THEN
    RETURN jsonb_build_object('success', false, 'reason', 'already_member', 'member_name', v_member_name);
  END IF;
  
  -- Assign the member (only update line_manager_id, NEVER touch user_roles)
  UPDATE public.employees
  SET line_manager_id = _manager_employee_id, updated_at = now()
  WHERE id = _member_employee_id;
  
  RETURN jsonb_build_object(
    'success', true, 
    'member_name', v_member_name,
    'manager_name', v_manager_name
  );
END;
$$;
