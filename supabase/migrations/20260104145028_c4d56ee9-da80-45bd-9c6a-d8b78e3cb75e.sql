-- Fix infinite recursion in task_assignees SELECT policy
-- The issue is that the policy queries task_assignees from within itself

-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can view task assignees" ON public.task_assignees;

-- Create a new policy that avoids self-reference
-- Users can view task assignees if:
-- 1. They are a manager/admin/vp, OR
-- 2. They created the task, OR
-- 3. They are assigned to the task (direct check without subquery to task_assignees)
CREATE POLICY "Users can view task assignees" ON public.task_assignees
FOR SELECT USING (
  -- Admins, VPs, and Managers can view all
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'vp'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  -- Task creator can view
  EXISTS (
    SELECT 1 FROM tasks t
    WHERE t.id = task_assignees.task_id AND t.created_by = auth.uid()
  ) OR
  -- User is themselves an assignee (direct check, no recursion)
  user_id = auth.uid()
);