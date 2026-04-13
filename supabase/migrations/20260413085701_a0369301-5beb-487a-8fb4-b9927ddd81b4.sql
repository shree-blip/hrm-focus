-- Function to check if employee is active (for login blocking)
CREATE OR REPLACE FUNCTION public.check_employee_active(check_email text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_employee RECORD;
BEGIN
  SELECT id, first_name, last_name, status
  INTO v_employee
  FROM public.employees
  WHERE lower(email) = lower(trim(check_email))
  LIMIT 1;

  IF NOT FOUND THEN
    -- No employee record, allow login (might be admin without employee record)
    RETURN jsonb_build_object('active', true, 'reason', 'no_employee_record');
  END IF;

  IF v_employee.status = 'inactive' THEN
    RETURN jsonb_build_object(
      'active', false, 
      'reason', 'deactivated',
      'name', v_employee.first_name || ' ' || v_employee.last_name
    );
  END IF;

  RETURN jsonb_build_object('active', true, 'reason', 'active');
END;
$$;