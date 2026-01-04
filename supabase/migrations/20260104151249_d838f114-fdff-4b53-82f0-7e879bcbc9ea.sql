-- Drop the problematic policy with incorrect self-reference
DROP POLICY IF EXISTS "Users can view assigned or created tasks" ON public.tasks;

-- Create corrected policy that references tasks.id instead of ta.id
CREATE POLICY "Users can view assigned or created tasks" 
ON public.tasks 
FOR SELECT 
USING (
  auth.uid() = created_by 
  OR auth.uid() = assignee_id
  OR EXISTS (
    SELECT 1 FROM task_assignees ta
    WHERE ta.task_id = tasks.id AND ta.user_id = auth.uid()
  )
);