-- Fix is_line_manager() to check actual employee relationships
-- instead of only matching on job_title = 'line manager'.
-- A user is a line manager if ANY employee has their employee ID
-- as line_manager_id or manager_id.

CREATE OR REPLACE FUNCTION public.is_line_manager(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.employees mgr
    JOIN public.profiles p ON mgr.profile_id = p.id
    WHERE p.user_id = _user_id
      AND (
        -- Check if anyone reports to this person via line_manager_id
        EXISTS (
          SELECT 1 FROM public.employees sub
          WHERE sub.line_manager_id = mgr.id
        )
        -- OR via manager_id
        OR EXISTS (
          SELECT 1 FROM public.employees sub
          WHERE sub.manager_id = mgr.id
        )
        -- OR has the 'line manager' job title (backwards compat)
        OR LOWER(mgr.job_title) = 'line manager'
      )
  )
$$;
