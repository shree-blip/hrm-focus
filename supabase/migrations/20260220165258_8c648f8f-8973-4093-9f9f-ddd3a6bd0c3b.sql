
-- Create task comments table
CREATE TABLE public.task_comments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

-- Only task creator, assignees, and managers can view comments
CREATE POLICY "Task participants can view comments"
ON public.task_comments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_comments.task_id
    AND (
      t.created_by = auth.uid()
      OR t.assignee_id = auth.uid()
      OR is_task_assignee(t.id, auth.uid())
      OR has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'vp'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
    )
  )
);

-- Task participants can insert comments
CREATE POLICY "Task participants can insert comments"
ON public.task_comments
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_comments.task_id
    AND (
      t.created_by = auth.uid()
      OR t.assignee_id = auth.uid()
      OR is_task_assignee(t.id, auth.uid())
    )
  )
);

-- Users can delete their own comments
CREATE POLICY "Users can delete own comments"
ON public.task_comments
FOR DELETE
USING (auth.uid() = user_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_comments;

-- Trigger for updated_at
CREATE TRIGGER update_task_comments_updated_at
BEFORE UPDATE ON public.task_comments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
