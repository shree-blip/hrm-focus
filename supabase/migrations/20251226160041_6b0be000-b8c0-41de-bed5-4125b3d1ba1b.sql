-- Drop the existing overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can view employees" ON public.employees;

-- Create policy for managers/VP/admin to view ALL employee data including sensitive fields
CREATE POLICY "Managers can view all employee data"
ON public.employees
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'vp'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role)
);

-- Create policy for regular employees to view only their own employee record
-- They can see their own data via profile_id linkage
CREATE POLICY "Employees can view their own employee record"
ON public.employees
FOR SELECT
USING (
  profile_id IN (
    SELECT id FROM public.profiles WHERE user_id = auth.uid()
  )
);

-- Create a view for non-sensitive employee data that all authenticated users can access
-- This allows the employee directory to still work without exposing salaries
CREATE OR REPLACE VIEW public.employee_directory AS
SELECT 
  id,
  first_name,
  last_name,
  email,
  department,
  job_title,
  location,
  status,
  hire_date,
  manager_id,
  profile_id
FROM public.employees
WHERE status = 'active';

-- Grant access to the view for authenticated users
GRANT SELECT ON public.employee_directory TO authenticated;