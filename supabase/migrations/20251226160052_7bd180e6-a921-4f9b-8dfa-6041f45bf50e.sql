-- Drop the SECURITY DEFINER view and recreate as SECURITY INVOKER
DROP VIEW IF EXISTS public.employee_directory;

-- Recreate with explicit SECURITY INVOKER (uses caller's permissions)
CREATE VIEW public.employee_directory 
WITH (security_invoker = true)
AS
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