-- Create a security definer function to check if user is direct manager of an employee
CREATE OR REPLACE FUNCTION public.is_direct_manager(_user_id uuid, _employee_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.employees e
    JOIN public.profiles p ON e.manager_id = p.id
    WHERE e.id = _employee_id 
      AND p.user_id = _user_id
  )
$$;

-- Create a security definer function to check if user can view salary data for an employee
-- Returns true for: admins, VPs, direct managers of the employee, or the employee themselves
CREATE OR REPLACE FUNCTION public.can_view_salary(_user_id uuid, _employee_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    -- Admins and VPs can view all salaries
    has_role(_user_id, 'admin'::app_role) OR
    has_role(_user_id, 'vp'::app_role) OR
    -- Direct managers can view their reports' salaries
    is_direct_manager(_user_id, _employee_id) OR
    -- Employees can view their own salary
    EXISTS (
      SELECT 1 FROM public.employees e
      JOIN public.profiles p ON e.profile_id = p.id
      WHERE e.id = _employee_id AND p.user_id = _user_id
    )
  )
$$;

-- Create a secure view for employee data with salary masking
-- Managers who aren't direct managers will see null for salary/hourly_rate
CREATE OR REPLACE VIEW public.employee_salary_view AS
SELECT 
  e.id,
  e.employee_id,
  e.first_name,
  e.last_name,
  e.email,
  e.phone,
  e.department,
  e.job_title,
  e.location,
  e.status,
  e.hire_date,
  e.pay_type,
  CASE 
    WHEN can_view_salary(auth.uid(), e.id) THEN e.salary
    ELSE NULL
  END as salary,
  CASE 
    WHEN can_view_salary(auth.uid(), e.id) THEN e.hourly_rate
    ELSE NULL
  END as hourly_rate,
  e.profile_id,
  e.manager_id,
  e.created_at,
  e.updated_at,
  e.termination_date
FROM public.employees e;

-- Grant access to the view
GRANT SELECT ON public.employee_salary_view TO authenticated;