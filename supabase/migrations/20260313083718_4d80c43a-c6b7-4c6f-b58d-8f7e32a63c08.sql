
-- Update get_visible_employee_ids to also check team_members junction table
CREATE OR REPLACE FUNCTION public.get_visible_employee_ids(_user_id uuid)
 RETURNS SETOF uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  user_org_id uuid;
  user_employee_id uuid;
BEGIN
  SELECT get_user_org_id(_user_id) INTO user_org_id;
  SELECT get_employee_id_for_user(_user_id) INTO user_employee_id;
  
  IF has_permission(_user_id, 'view_employees_all') THEN
    RETURN QUERY 
    SELECT id FROM public.employees 
    WHERE status = 'active' 
      AND (org_id = user_org_id OR org_id IS NULL);
    RETURN;
  END IF;
  
  IF has_permission(_user_id, 'view_employees_reports_only') THEN
    RETURN QUERY 
    SELECT DISTINCT e.id FROM public.employees e
    WHERE e.status = 'active' 
      AND (e.org_id = user_org_id OR e.org_id IS NULL)
      AND (
        e.manager_id = user_employee_id 
        OR e.line_manager_id = user_employee_id
        OR e.id IN (
          SELECT tm.member_employee_id 
          FROM public.team_members tm 
          WHERE tm.manager_employee_id = user_employee_id
        )
      );
    RETURN;
  END IF;
  
  IF user_employee_id IS NOT NULL THEN
    RETURN QUERY SELECT user_employee_id;
  END IF;
  
  RETURN;
END;
$$;

-- Update is_direct_manager to also check team_members junction table
CREATE OR REPLACE FUNCTION public.is_direct_manager(_user_id uuid, _employee_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  user_org_id uuid;
  employee_org_id uuid;
  user_emp_id uuid;
BEGIN
  SELECT get_user_org_id(_user_id) INTO user_org_id;
  SELECT org_id INTO employee_org_id FROM public.employees WHERE id = _employee_id;
  
  IF user_org_id IS DISTINCT FROM employee_org_id AND employee_org_id IS NOT NULL THEN
    RETURN false;
  END IF;
  
  SELECT get_employee_id_for_user(_user_id) INTO user_emp_id;
  
  RETURN EXISTS (
    SELECT 1 FROM public.employees 
    WHERE id = _employee_id 
      AND (manager_id = user_emp_id OR line_manager_id = user_emp_id)
  )
  OR EXISTS (
    SELECT 1 FROM public.team_members
    WHERE manager_employee_id = user_emp_id
      AND member_employee_id = _employee_id
  );
END;
$$;
