-- Fix 1: Revoke broad SELECT access from employee_salary_view
-- The view uses SECURITY INVOKER which will check base table RLS
-- But the GRANT SELECT to authenticated bypasses the visibility controls
REVOKE SELECT ON employee_salary_view FROM authenticated;

-- Fix 2: Replace the overly permissive tasks SELECT policy
-- Drop the wide-open policy
DROP POLICY IF EXISTS "Authenticated users can view tasks" ON public.tasks;

-- Add granular policies for task visibility
CREATE POLICY "Users can view assigned or created tasks"
ON public.tasks
FOR SELECT
USING (
  auth.uid() = created_by OR 
  auth.uid() = assignee_id
);

-- Managers can view all tasks (they already have ALL policy, but add explicit SELECT for clarity)
CREATE POLICY "Managers can view all tasks"
ON public.tasks
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'vp'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role)
);