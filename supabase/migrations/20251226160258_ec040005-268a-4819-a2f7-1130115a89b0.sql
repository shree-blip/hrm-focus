-- Drop the public SELECT policy that exposes all emails
DROP POLICY IF EXISTS "Anyone can check allowed emails" ON public.allowed_signups;

-- Create a secure function to verify if an email is allowed (without exposing the list)
CREATE OR REPLACE FUNCTION public.verify_signup_email(check_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  signup_record record;
BEGIN
  SELECT email, is_used, employee_id 
  INTO signup_record
  FROM public.allowed_signups 
  WHERE email = lower(check_email);
  
  IF signup_record IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'not_found'
    );
  END IF;
  
  IF signup_record.is_used THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'already_used'
    );
  END IF;
  
  -- If valid, return success with employee_id for fetching details
  RETURN jsonb_build_object(
    'allowed', true,
    'employee_id', signup_record.employee_id
  );
END;
$$;

-- Create a secure function to mark signup as used (called after successful registration)
CREATE OR REPLACE FUNCTION public.mark_signup_used(check_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.allowed_signups
  SET is_used = true, used_at = now()
  WHERE email = lower(check_email) AND is_used = false;
  
  RETURN FOUND;
END;
$$;

-- Policy: Only managers/admins can view the full allowed_signups list
CREATE POLICY "Managers can view allowed signups"
ON public.allowed_signups
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'vp') OR public.has_role(auth.uid(), 'manager'));

-- Policy: Only managers/admins can insert new allowed signups
CREATE POLICY "Managers can insert allowed signups"
ON public.allowed_signups
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'vp') OR public.has_role(auth.uid(), 'manager'));

-- Policy: Only managers/admins can update allowed signups
CREATE POLICY "Managers can update allowed signups"
ON public.allowed_signups
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'vp') OR public.has_role(auth.uid(), 'manager'));

-- Policy: Only admins can delete allowed signups
CREATE POLICY "Admins can delete allowed signups"
ON public.allowed_signups
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));