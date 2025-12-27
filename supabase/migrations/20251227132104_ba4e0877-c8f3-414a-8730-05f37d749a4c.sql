-- Drop the security definer view and recreate with SECURITY INVOKER
-- The salary masking logic in can_view_salary already handles access control
DROP VIEW IF EXISTS public.employee_salary_view;

CREATE VIEW public.employee_salary_view 
WITH (security_invoker = true)
AS
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