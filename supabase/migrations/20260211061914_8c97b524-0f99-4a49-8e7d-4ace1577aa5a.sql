
-- Drop and recreate employee_salary_view with new columns
DROP VIEW IF EXISTS public.employee_salary_view;

CREATE VIEW public.employee_salary_view AS
SELECT 
  e.id,
  e.first_name,
  e.last_name,
  e.email,
  e.phone,
  e.department,
  e.job_title,
  e.location,
  e.status,
  e.pay_type,
  e.employee_id,
  e.hire_date,
  e.termination_date,
  e.manager_id,
  e.line_manager_id,
  e.profile_id,
  e.created_at,
  e.updated_at,
  CASE 
    WHEN can_view_salary(auth.uid(), e.id) THEN e.salary
    ELSE NULL
  END AS salary,
  CASE 
    WHEN can_view_salary(auth.uid(), e.id) THEN e.hourly_rate
    ELSE NULL
  END AS hourly_rate,
  CASE 
    WHEN can_view_salary(auth.uid(), e.id) THEN e.income_tax
    ELSE NULL
  END AS income_tax,
  CASE 
    WHEN can_view_salary(auth.uid(), e.id) THEN e.social_security
    ELSE NULL
  END AS social_security,
  CASE 
    WHEN can_view_salary(auth.uid(), e.id) THEN e.provident_fund
    ELSE NULL
  END AS provident_fund,
  e.gender,
  CASE 
    WHEN can_view_salary(auth.uid(), e.id) THEN e.insurance_premium
    ELSE NULL
  END AS insurance_premium,
  e.include_dashain_bonus
FROM public.employees e
WHERE e.status = 'active';
