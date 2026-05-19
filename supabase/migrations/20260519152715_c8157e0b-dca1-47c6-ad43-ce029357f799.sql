
CREATE OR REPLACE FUNCTION public.check_email_registration(_email text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _normalized text := lower(trim(_email));
  _auth_user_id uuid;
  _profile_id uuid;
  _employee_id uuid;
BEGIN
  -- Only authenticated managers/admins should call this; rely on caller permission gating in app
  IF _normalized IS NULL OR _normalized = '' THEN
    RETURN jsonb_build_object(
      'exists', false,
      'exists_in_auth', false,
      'exists_in_profiles', false,
      'exists_in_employees', false
    );
  END IF;

  SELECT id INTO _auth_user_id
  FROM auth.users
  WHERE lower(email) = _normalized
  LIMIT 1;

  SELECT id INTO _profile_id
  FROM public.profiles
  WHERE lower(email) = _normalized
  LIMIT 1;

  SELECT id INTO _employee_id
  FROM public.employees
  WHERE lower(email) = _normalized
  LIMIT 1;

  RETURN jsonb_build_object(
    'exists', (_auth_user_id IS NOT NULL OR _profile_id IS NOT NULL OR _employee_id IS NOT NULL),
    'exists_in_auth', _auth_user_id IS NOT NULL,
    'exists_in_profiles', _profile_id IS NOT NULL,
    'exists_in_employees', _employee_id IS NOT NULL,
    'auth_user_id', _auth_user_id,
    'profile_id', _profile_id,
    'employee_id', _employee_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.check_email_registration(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.check_email_registration(text) TO authenticated;
