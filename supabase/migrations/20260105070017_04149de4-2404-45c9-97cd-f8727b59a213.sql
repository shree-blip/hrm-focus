-- Fix verify_signup_email RPC (was failing with "identifier is ambiguous")
-- Existing function return type differs; drop and recreate with JSONB (matches generated types: Json).

DROP FUNCTION IF EXISTS public.verify_signup_email(text);

CREATE FUNCTION public.verify_signup_email(check_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(trim(check_email));
  v_row record;
BEGIN
  SELECT a.email, a.is_used, a.employee_id
    INTO v_row
  FROM public.allowed_signups a
  WHERE lower(a.email) = v_email
  ORDER BY a.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'not_invited');
  END IF;

  IF coalesce(v_row.is_used, false) THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'already_used', 'employee_id', v_row.employee_id);
  END IF;

  RETURN jsonb_build_object('allowed', true, 'employee_id', v_row.employee_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_signup_email(text) TO anon, authenticated;