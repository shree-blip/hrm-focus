-- Fix SECURITY DEFINER views by recreating them with SECURITY INVOKER (default)
-- Drop and recreate employee_directory view
DROP VIEW IF EXISTS public.employee_directory;
CREATE VIEW public.employee_directory 
WITH (security_invoker = on) AS
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
  line_manager_id,
  profile_id
FROM public.employees
WHERE status = 'active';

-- Drop and recreate employee_salary_view
DROP VIEW IF EXISTS public.employee_salary_view;
CREATE VIEW public.employee_salary_view 
WITH (security_invoker = on) AS
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
  e.termination_date,
  e.pay_type,
  e.manager_id,
  e.line_manager_id,
  e.profile_id,
  e.created_at,
  e.updated_at,
  CASE 
    WHEN can_view_salary(e.id, auth.uid()) THEN e.salary
    ELSE NULL
  END as salary,
  CASE 
    WHEN can_view_salary(e.id, auth.uid()) THEN e.hourly_rate
    ELSE NULL
  END as hourly_rate
FROM public.employees e;