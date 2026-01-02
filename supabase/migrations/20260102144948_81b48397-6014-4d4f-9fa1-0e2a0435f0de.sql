-- Step 1: Add line_manager_id column to employees table
ALTER TABLE public.employees 
ADD COLUMN IF NOT EXISTS line_manager_id uuid REFERENCES public.employees(id);

-- Step 2: Insert Jay Dahal as top-level VP (no manager)
INSERT INTO public.employees (id, first_name, last_name, email, job_title, department, status, manager_id, line_manager_id)
VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'Jay',
  'Dahal',
  'jay.dahal@focusyourfinance.com',
  'Vice President',
  'Executive',
  'active',
  NULL,
  NULL
);

-- Step 3: Insert Adish Dahal as Manager, reporting to Jay
INSERT INTO public.employees (id, first_name, last_name, email, job_title, department, status, manager_id, line_manager_id)
VALUES (
  'b2c3d4e5-f6a7-8901-bcde-f23456789012',
  'Adish',
  'Dahal',
  'adish.dahal@focusyourfinance.com',
  'Manager',
  'Operations',
  'active',
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890', -- Jay is manager
  NULL
);

-- Step 4: Update Ganesh Dahal to report to Jay as manager
UPDATE public.employees 
SET manager_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
WHERE id = '5afdb927-e785-46f7-a331-830061e70dc3';

-- Step 5: Update Salmon Adhikari's job title to Line Manager, reporting to Jay
UPDATE public.employees 
SET job_title = 'Line Manager',
    manager_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
WHERE id = '397d1785-f480-43d7-8a11-a25944a0217c';

-- Step 6: Set Salmon as line_manager_id for all employees except Jay and Salmon himself
UPDATE public.employees 
SET line_manager_id = '397d1785-f480-43d7-8a11-a25944a0217c'
WHERE id NOT IN (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890', -- Jay
  '397d1785-f480-43d7-8a11-a25944a0217c'  -- Salmon
);

-- Step 7: Split employees between Adish and Ganesh as manager_id
-- First half goes to Adish (alphabetically by first_name)
WITH ranked_employees AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY first_name) as rn, COUNT(*) OVER() as total
  FROM public.employees
  WHERE id NOT IN (
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890', -- Jay (VP)
    '5afdb927-e785-46f7-a331-830061e70dc3', -- Ganesh (Manager)
    'b2c3d4e5-f6a7-8901-bcde-f23456789012'  -- Adish (Manager)
  )
)
UPDATE public.employees e
SET manager_id = 'b2c3d4e5-f6a7-8901-bcde-f23456789012' -- Adish
FROM ranked_employees r
WHERE e.id = r.id AND r.rn <= r.total / 2;

-- Second half goes to Ganesh
WITH ranked_employees AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY first_name) as rn, COUNT(*) OVER() as total
  FROM public.employees
  WHERE id NOT IN (
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890', -- Jay (VP)
    '5afdb927-e785-46f7-a331-830061e70dc3', -- Ganesh (Manager)
    'b2c3d4e5-f6a7-8901-bcde-f23456789012'  -- Adish (Manager)
  )
)
UPDATE public.employees e
SET manager_id = '5afdb927-e785-46f7-a331-830061e70dc3' -- Ganesh
FROM ranked_employees r
WHERE e.id = r.id AND r.rn > r.total / 2;

-- Step 8: Update the employee_directory view to include line_manager_id
DROP VIEW IF EXISTS public.employee_directory;
CREATE VIEW public.employee_directory AS
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

-- Step 9: Update the employee_salary_view to include line_manager_id
DROP VIEW IF EXISTS public.employee_salary_view;
CREATE VIEW public.employee_salary_view AS
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