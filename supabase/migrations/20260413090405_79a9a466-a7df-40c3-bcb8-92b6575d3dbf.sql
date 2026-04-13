-- Update employee_directory view to include inactive employees
CREATE OR REPLACE VIEW public.employee_directory
WITH (security_invoker = on)
AS
SELECT id, first_name, last_name, email, department, job_title, location, status, hire_date, manager_id, line_manager_id, profile_id
FROM employees
WHERE status IS NULL OR status IN ('active', 'probation', 'inactive');

-- Update employee_salary_view to include inactive employees
CREATE OR REPLACE VIEW public.employee_salary_view
WITH (security_invoker = on)
AS
SELECT 
  id, first_name, last_name, email, phone, department, job_title, location, status,
  pay_type, employee_id, hire_date, termination_date, manager_id, line_manager_id, profile_id,
  created_at, updated_at,
  CASE WHEN can_view_salary(auth.uid(), id) THEN salary ELSE NULL END AS salary,
  CASE WHEN can_view_salary(auth.uid(), id) THEN hourly_rate ELSE NULL END AS hourly_rate,
  CASE WHEN can_view_salary(auth.uid(), id) THEN income_tax ELSE NULL END AS income_tax,
  CASE WHEN can_view_salary(auth.uid(), id) THEN social_security ELSE NULL END AS social_security,
  CASE WHEN can_view_salary(auth.uid(), id) THEN provident_fund ELSE NULL END AS provident_fund,
  gender,
  CASE WHEN can_view_salary(auth.uid(), id) THEN insurance_premium ELSE NULL END AS insurance_premium,
  include_dashain_bonus
FROM employees e
WHERE status IS NULL OR status IN ('active', 'probation', 'inactive');