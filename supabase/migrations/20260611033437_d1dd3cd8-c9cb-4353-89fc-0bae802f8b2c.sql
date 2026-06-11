CREATE OR REPLACE VIEW public.employee_directory
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
    profile_id,
    employment_type
FROM employees
WHERE status IS NULL OR (status = ANY (ARRAY['active'::text, 'probation'::text, 'inactive'::text]));

CREATE OR REPLACE VIEW public.employee_salary_view
WITH (security_invoker = on) AS
SELECT
    id,
    first_name,
    last_name,
    email,
    phone,
    department,
    job_title,
    location,
    status,
    pay_type,
    employee_id,
    hire_date,
    termination_date,
    manager_id,
    line_manager_id,
    profile_id,
    created_at,
    updated_at,
    CASE WHEN can_view_salary(auth.uid(), id) THEN salary ELSE NULL::numeric END AS salary,
    CASE WHEN can_view_salary(auth.uid(), id) THEN hourly_rate ELSE NULL::numeric END AS hourly_rate,
    CASE WHEN can_view_salary(auth.uid(), id) THEN income_tax ELSE NULL::numeric END AS income_tax,
    CASE WHEN can_view_salary(auth.uid(), id) THEN social_security ELSE NULL::numeric END AS social_security,
    CASE WHEN can_view_salary(auth.uid(), id) THEN provident_fund ELSE NULL::numeric END AS provident_fund,
    gender,
    CASE WHEN can_view_salary(auth.uid(), id) THEN insurance_premium ELSE NULL::numeric END AS insurance_premium,
    include_dashain_bonus,
    employment_type
FROM employees e
WHERE status IS NULL OR (status = ANY (ARRAY['active'::text, 'probation'::text, 'inactive'::text]));