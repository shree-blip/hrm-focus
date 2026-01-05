-- Update handle_new_user to sync employee data to profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_employee RECORD;
  v_profile_id uuid;
BEGIN
  -- Check if employee record exists for this email
  SELECT id, first_name, last_name, job_title, department, location, phone
  INTO v_employee
  FROM public.employees
  WHERE lower(email) = lower(NEW.email)
  LIMIT 1;

  -- Create profile with employee data if found, otherwise use signup metadata
  INSERT INTO public.profiles (user_id, first_name, last_name, email, job_title, department, location, phone)
  VALUES (
    NEW.id,
    COALESCE(v_employee.first_name, NEW.raw_user_meta_data ->> 'first_name', 'New'),
    COALESCE(v_employee.last_name, NEW.raw_user_meta_data ->> 'last_name', 'User'),
    NEW.email,
    v_employee.job_title,
    v_employee.department,
    v_employee.location,
    v_employee.phone
  )
  RETURNING id INTO v_profile_id;

  -- Link employee to profile if employee exists
  IF v_employee.id IS NOT NULL THEN
    UPDATE public.employees
    SET profile_id = v_profile_id
    WHERE id = v_employee.id;
  END IF;

  -- Create default role for new user
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'employee');

  -- Create default leave balances
  INSERT INTO public.leave_balances (user_id, leave_type, total_days) VALUES
    (NEW.id, 'Annual Leave', 20),
    (NEW.id, 'Sick Leave', 10),
    (NEW.id, 'Personal Leave', 3),
    (NEW.id, 'Comp Time', 5);

  -- Create default preferences
  INSERT INTO public.user_preferences (user_id) VALUES (NEW.id);

  RETURN NEW;
END;
$$;

-- Also create a function to sync existing profiles with employee data
CREATE OR REPLACE FUNCTION public.sync_profile_with_employee()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update profiles with employee data where emails match
  UPDATE public.profiles p
  SET
    first_name = COALESCE(e.first_name, p.first_name),
    last_name = COALESCE(e.last_name, p.last_name),
    job_title = COALESCE(e.job_title, p.job_title),
    department = COALESCE(e.department, p.department),
    location = COALESCE(e.location, p.location),
    phone = COALESCE(e.phone, p.phone),
    updated_at = now()
  FROM public.employees e
  WHERE lower(p.email) = lower(e.email);

  -- Link employees to profiles
  UPDATE public.employees e
  SET profile_id = p.id
  FROM public.profiles p
  WHERE lower(e.email) = lower(p.email)
    AND e.profile_id IS NULL;
END;
$$;

-- Run the sync immediately to fix existing data
SELECT public.sync_profile_with_employee();