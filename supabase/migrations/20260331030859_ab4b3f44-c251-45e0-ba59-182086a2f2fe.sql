-- Create missing profile for Mohit Luitel
INSERT INTO public.profiles (user_id, first_name, last_name, email)
VALUES ('ddc48d2c-9e5c-43ff-89d4-b1d1c7391491', 'Mohit', 'Luitel', 'mohit@focusyourfinance.com');

-- Link employee to the new profile
UPDATE public.employees
SET profile_id = (SELECT id FROM public.profiles WHERE user_id = 'ddc48d2c-9e5c-43ff-89d4-b1d1c7391491')
WHERE id = '49056474-3f19-4425-a79d-f76d68973225';

-- Ensure Mohit has a default role
INSERT INTO public.user_roles (user_id, role)
VALUES ('ddc48d2c-9e5c-43ff-89d4-b1d1c7391491', 'employee')
ON CONFLICT (user_id, role) DO NOTHING;

-- Ensure Mohit has leave balances
INSERT INTO public.leave_balances (user_id, leave_type, total_days)
SELECT 'ddc48d2c-9e5c-43ff-89d4-b1d1c7391491', lt, td
FROM (VALUES ('Annual Leave', 20), ('Sick Leave', 10), ('Personal Leave', 3), ('Comp Time', 5)) AS v(lt, td)
WHERE NOT EXISTS (
  SELECT 1 FROM public.leave_balances WHERE user_id = 'ddc48d2c-9e5c-43ff-89d4-b1d1c7391491' AND leave_type = v.lt
);