-- Fix is_security_monitor() to use role-based check instead of hardcoded emails
-- This removes the security vulnerability of hardcoded email addresses

CREATE OR REPLACE FUNCTION public.is_security_monitor(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    has_role(_user_id, 'vp'::app_role) OR 
    has_role(_user_id, 'admin'::app_role)
$$;

COMMENT ON FUNCTION public.is_security_monitor IS 'Security-hardened version: uses role-based access control instead of hardcoded emails';