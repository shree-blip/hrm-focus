CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_employee RECORD;
  v_profile_id uuid;
  v_first_name text;
  v_last_name text;
  v_avatar_url text;
BEGIN
  -- Check if employee record exists for this email
  SELECT id, first_name, last_name, job_title, department, location, phone
  INTO v_employee
  FROM public.employees
  WHERE lower(email) = lower(NEW.email)
  LIMIT 1;

  -- Resolve name from: employee > signup metadata > Google metadata > fallback
  v_first_name := COALESCE(
    v_employee.first_name,
    NEW.raw_user_meta_data ->> 'first_name',
    split_part(COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''), ' ', 1),
    NEW.raw_user_meta_data ->> 'name',
    'New'
  );
  v_last_name := COALESCE(
    v_employee.last_name,
    NEW.raw_user_meta_data ->> 'last_name',
    NULLIF(split_part(COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''), ' ', 2), ''),
    'User'
  );
  v_avatar_url := NEW.raw_user_meta_data ->> 'avatar_url';

  -- Check if profile already exists for this user_id (re-entrant safety)
  SELECT id INTO v_profile_id FROM public.profiles WHERE user_id = NEW.id;

  IF v_profile_id IS NOT NULL THEN
    -- Profile exists, just update it
    UPDATE public.profiles
    SET first_name = v_first_name,
        last_name = v_last_name,
        email = NEW.email,
        avatar_url = COALESCE(avatar_url, v_avatar_url),
        job_title = COALESCE(job_title, v_employee.job_title),
        department = COALESCE(department, v_employee.department),
        location = COALESCE(location, v_employee.location),
        phone = COALESCE(phone, v_employee.phone),
        updated_at = now()
    WHERE id = v_profile_id;
  ELSE
    -- Check if profile exists for this email but different user_id (shouldn't happen but be safe)
    SELECT id INTO v_profile_id FROM public.profiles WHERE lower(email) = lower(NEW.email) AND user_id IS NULL;
    
    IF v_profile_id IS NOT NULL THEN
      -- Claim the orphan profile
      UPDATE public.profiles
      SET user_id = NEW.id,
          first_name = v_first_name,
          last_name = v_last_name,
          avatar_url = COALESCE(avatar_url, v_avatar_url),
          job_title = COALESCE(job_title, v_employee.job_title),
          department = COALESCE(department, v_employee.department),
          location = COALESCE(location, v_employee.location),
          phone = COALESCE(phone, v_employee.phone),
          updated_at = now()
      WHERE id = v_profile_id;
    ELSE
      -- Create new profile
      INSERT INTO public.profiles (user_id, first_name, last_name, email, avatar_url, job_title, department, location, phone)
      VALUES (
        NEW.id,
        v_first_name,
        v_last_name,
        NEW.email,
        v_avatar_url,
        v_employee.job_title,
        v_employee.department,
        v_employee.location,
        v_employee.phone
      )
      RETURNING id INTO v_profile_id;
    END IF;
  END IF;

  -- Link employee to profile if employee exists
  IF v_employee.id IS NOT NULL AND v_profile_id IS NOT NULL THEN
    UPDATE public.employees
    SET profile_id = v_profile_id
    WHERE id = v_employee.id AND (profile_id IS NULL OR profile_id != v_profile_id);
  END IF;

  -- Mark the allowed_signups entry as used
  UPDATE public.allowed_signups
  SET is_used = true, used_at = now()
  WHERE lower(email) = lower(NEW.email) AND (is_used = false OR is_used IS NULL);

  -- Create default role for new user (skip if exists)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'employee')
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Create default leave balances (skip if exists)
  INSERT INTO public.leave_balances (user_id, leave_type, total_days)
  VALUES
    (NEW.id, 'Annual Leave', 20),
    (NEW.id, 'Sick Leave', 10),
    (NEW.id, 'Personal Leave', 3),
    (NEW.id, 'Comp Time', 5)
  ON CONFLICT DO NOTHING;

  -- Create default preferences (skip if exists)
  INSERT INTO public.user_preferences (user_id) VALUES (NEW.id)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;