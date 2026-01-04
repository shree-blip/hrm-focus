-- Create task_assignees junction table for multi-user assignment
CREATE TABLE public.task_assignees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  assigned_by UUID NOT NULL,
  UNIQUE(task_id, user_id)
);

-- Enable RLS
ALTER TABLE public.task_assignees ENABLE ROW LEVEL SECURITY;

-- Users can view assignees for tasks they can see
CREATE POLICY "Users can view task assignees"
ON public.task_assignees
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.tasks t 
    WHERE t.id = task_id 
    AND (
      t.created_by = auth.uid() 
      OR has_role(auth.uid(), 'admin'::app_role) 
      OR has_role(auth.uid(), 'vp'::app_role) 
      OR has_role(auth.uid(), 'manager'::app_role)
      OR EXISTS (SELECT 1 FROM public.task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = auth.uid())
    )
  )
);

-- Managers and task owners can insert assignees
CREATE POLICY "Task owners and managers can assign users"
ON public.task_assignees
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.tasks t 
    WHERE t.id = task_id 
    AND (
      t.created_by = auth.uid() 
      OR has_role(auth.uid(), 'admin'::app_role) 
      OR has_role(auth.uid(), 'vp'::app_role) 
      OR has_role(auth.uid(), 'manager'::app_role)
    )
  )
);

-- Managers and task owners can update assignees
CREATE POLICY "Task owners and managers can update assignees"
ON public.task_assignees
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.tasks t 
    WHERE t.id = task_id 
    AND (
      t.created_by = auth.uid() 
      OR has_role(auth.uid(), 'admin'::app_role) 
      OR has_role(auth.uid(), 'vp'::app_role) 
      OR has_role(auth.uid(), 'manager'::app_role)
    )
  )
);

-- Managers and task owners can delete assignees
CREATE POLICY "Task owners and managers can remove assignees"
ON public.task_assignees
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.tasks t 
    WHERE t.id = task_id 
    AND (
      t.created_by = auth.uid() 
      OR has_role(auth.uid(), 'admin'::app_role) 
      OR has_role(auth.uid(), 'vp'::app_role) 
      OR has_role(auth.uid(), 'manager'::app_role)
    )
  )
);

-- Update the tasks RLS policy for visibility based on task_assignees
DROP POLICY IF EXISTS "Users can view assigned or created tasks" ON public.tasks;

CREATE POLICY "Users can view assigned or created tasks"
ON public.tasks
FOR SELECT
USING (
  auth.uid() = created_by 
  OR EXISTS (SELECT 1 FROM public.task_assignees ta WHERE ta.task_id = id AND ta.user_id = auth.uid())
);

-- Enable realtime for task_assignees
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_assignees;