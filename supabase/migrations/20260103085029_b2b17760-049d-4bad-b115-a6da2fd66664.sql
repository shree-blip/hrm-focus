-- Fix the profiles table RLS policy to require authentication
-- Drop the problematic policy that allows unauthenticated access
DROP POLICY IF EXISTS "Users can view org profiles" ON public.profiles;

-- Create a new secure policy that requires authentication
CREATE POLICY "Users can view org profiles"
ON public.profiles
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND (
    (org_id = get_user_org_id(auth.uid())) OR 
    (org_id IS NULL) OR 
    (user_id = auth.uid())
  )
);