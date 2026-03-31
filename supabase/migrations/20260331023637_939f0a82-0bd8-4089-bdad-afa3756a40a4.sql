-- 1. Drop the blanket USING(true) SELECT policy on attendance_logs
DROP POLICY IF EXISTS "All authenticated users can view attendance for realtime dashbo" ON public.attendance_logs;

-- 2. Fix leave_requests: change public approved leaves policy to authenticated only
DROP POLICY IF EXISTS "All users can view approved leaves for team calendar" ON public.leave_requests;
CREATE POLICY "Authenticated users can view approved leaves for team calendar"
  ON public.leave_requests FOR SELECT TO authenticated
  USING (status = 'approved');

-- 3. Replace is_it_team hardcoded UUID with role-based check
CREATE OR REPLACE FUNCTION public.is_it_team(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT 
    has_role(_user_id, 'admin'::app_role) OR
    has_permission(_user_id, 'manage_support')
$$;