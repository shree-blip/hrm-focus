-- Drop and recreate employee_salary_view with deduction columns
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
  END as hourly_rate,
  CASE 
    WHEN can_view_salary(e.id, auth.uid()) THEN e.income_tax
    ELSE NULL
  END as income_tax,
  CASE 
    WHEN can_view_salary(e.id, auth.uid()) THEN e.social_security
    ELSE NULL
  END as social_security,
  CASE 
    WHEN can_view_salary(e.id, auth.uid()) THEN e.provident_fund
    ELSE NULL
  END as provident_fund
FROM public.employees e;