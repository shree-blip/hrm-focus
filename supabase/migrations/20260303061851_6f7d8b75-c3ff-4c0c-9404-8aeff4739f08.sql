-- Drop the broken trigger and function with placeholders
DROP TRIGGER IF EXISTS trg_set_loan_routing ON public.loan_requests;
DROP FUNCTION IF EXISTS public.set_loan_routing();

-- Recreate with actual table and column names
CREATE OR REPLACE FUNCTION public.set_loan_routing()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_manager_user uuid;
  v_vp_user uuid;
BEGIN
  -- Resolve manager_user_id: employee -> line_manager -> profile -> user_id
  SELECT p.user_id
    INTO v_manager_user
  FROM employees e
  JOIN employees m ON m.id = e.line_manager_id
  JOIN profiles p ON p.id = m.profile_id
  WHERE e.id = NEW.employee_id;

  -- If no line_manager, try manager_id
  IF v_manager_user IS NULL THEN
    SELECT p.user_id
      INTO v_manager_user
    FROM employees e
    JOIN employees m ON m.id = e.manager_id
    JOIN profiles p ON p.id = m.profile_id
    WHERE e.id = NEW.employee_id;
  END IF;

  -- Resolve VP user from user_roles table
  SELECT ur.user_id
    INTO v_vp_user
  FROM user_roles ur
  WHERE ur.role = 'vp'
  LIMIT 1;

  NEW.manager_user_id := COALESCE(NEW.manager_user_id, v_manager_user);
  NEW.vp_user_id := COALESCE(NEW.vp_user_id, v_vp_user);

  RETURN NEW;
END;
$$;

-- Re-create the trigger
CREATE TRIGGER trg_set_loan_routing
  BEFORE INSERT ON public.loan_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.set_loan_routing();
