-- 1. Add 'line_manager' role to app_role enum if it doesn't exist
-- Note: The role check will use job_title = 'Line Manager' instead of a separate role

-- 2. Create function to check if user is a line manager (by job title)
CREATE OR REPLACE FUNCTION public.is_line_manager(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.employees e
    JOIN public.profiles p ON e.profile_id = p.id
    WHERE p.user_id = _user_id 
      AND LOWER(e.job_title) = 'line manager'
  )
$$;

-- 3. Create function to get the employee record for a user
CREATE OR REPLACE FUNCTION public.get_employee_id_for_user(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.id 
  FROM public.employees e
  JOIN public.profiles p ON e.profile_id = p.id
  WHERE p.user_id = _user_id
  LIMIT 1
$$;

-- 4. Create function to check if user can create employees (VP or Line Manager)
CREATE OR REPLACE FUNCTION public.can_create_employee(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    has_role(_user_id, 'vp'::app_role) OR
    has_role(_user_id, 'admin'::app_role) OR
    is_line_manager(_user_id)
  )
$$;

-- 5. Update employees INSERT policy to allow VP and Line Managers
DROP POLICY IF EXISTS "Managers can insert employees" ON public.employees;
CREATE POLICY "VP and Line Managers can insert employees" 
ON public.employees 
FOR INSERT 
WITH CHECK (can_create_employee(auth.uid()));

-- 6. Add policy for line managers to view their direct reports
DROP POLICY IF EXISTS "Line managers can view their team" ON public.employees;
CREATE POLICY "Line managers can view their team" 
ON public.employees 
FOR SELECT 
USING (
  line_manager_id = get_employee_id_for_user(auth.uid())
);

-- 7. Update the verify_signup_email function to check employees table instead of allowed_signups only
CREATE OR REPLACE FUNCTION public.verify_signup_email(check_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  signup_record record;
  employee_record record;
  client_ip text;
BEGIN
  -- Get client IP for rate limiting
  client_ip := COALESCE(
    current_setting('request.headers', true)::json->>'x-forwarded-for',
    'unknown'
  );
  
  -- Rate limit: 10 calls per 5 minutes per IP
  IF NOT check_rate_limit('verify_signup_email', client_ip, 10, 300) THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'invalid'
    );
  END IF;
  
  -- First check allowed_signups table (existing behavior)
  SELECT email, is_used, employee_id 
  INTO signup_record
  FROM public.allowed_signups 
  WHERE email = lower(check_email);
  
  -- If found in allowed_signups and not used, use that
  IF signup_record IS NOT NULL AND NOT signup_record.is_used THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'employee_id', signup_record.employee_id
    );
  END IF;
  
  -- If not in allowed_signups OR already used, check employees table directly
  -- This allows newly created employees to sign up
  SELECT id, first_name, last_name, status
  INTO employee_record
  FROM public.employees
  WHERE LOWER(email) = LOWER(check_email)
    AND status = 'active';
  
  IF employee_record IS NOT NULL THEN
    -- Check if a user with this email already exists in auth.users (via profiles)
    IF EXISTS (
      SELECT 1 FROM public.profiles WHERE LOWER(email) = LOWER(check_email)
    ) THEN
      RETURN jsonb_build_object(
        'allowed', false,
        'reason', 'already_used'
      );
    END IF;
    
    RETURN jsonb_build_object(
      'allowed', true,
      'employee_id', employee_record.id
    );
  END IF;
  
  -- Not found anywhere
  RETURN jsonb_build_object(
    'allowed', false,
    'reason', 'invalid'
  );
END;
$$;

-- 8. Add policy for line managers to view attendance logs of their team
DROP POLICY IF EXISTS "Line managers can view team attendance" ON public.attendance_logs;
CREATE POLICY "Line managers can view team attendance" 
ON public.attendance_logs 
FOR SELECT 
USING (
  employee_id IN (
    SELECT id FROM public.employees 
    WHERE line_manager_id = get_employee_id_for_user(auth.uid())
  )
);