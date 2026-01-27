-- Create a security definer function to get users with management roles
-- This allows any authenticated user to find recipients without exposing all role data
CREATE OR REPLACE FUNCTION public.get_management_user_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_id 
  FROM public.user_roles 
  WHERE role IN ('manager', 'admin', 'vp')
$$;

-- Create function to get all user_ids for document sharing (for managers/admins/vps)
CREATE OR REPLACE FUNCTION public.get_all_user_ids_for_sharing()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT user_id FROM public.profiles WHERE user_id IS NOT NULL
$$;