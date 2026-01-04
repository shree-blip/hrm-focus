-- Break RLS recursion between tasks <-> task_assignees by using SECURITY DEFINER helper functions

-- Helper: is user assigned to a task?
CREATE OR REPLACE FUNCTION public.is_task_assignee(_task_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.task_assignees ta
    WHERE ta.task_id = _task_id
      AND ta.user_id = _user_id
  );
$$;

-- Helper: can user manage a task (owner or elevated role)
CREATE OR REPLACE FUNCTION public.can_manage_task(_task_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tasks t
    WHERE t.id = _task_id
      AND (
        t.created_by = _user_id
        OR public.has_role(_user_id, 'admin'::public.app_role)
        OR public.has_role(_user_id, 'vp'::public.app_role)
        OR public.has_role(_user_id, 'manager'::public.app_role)
      )
  );
$$;

-- ===== Fix tasks policies =====
DROP POLICY IF EXISTS "Users can view assigned or created tasks" ON public.tasks;

CREATE POLICY "Users can view assigned or created tasks"
ON public.tasks
FOR SELECT
USING (
  auth.uid() = created_by
  OR auth.uid() = assignee_id
  OR public.is_task_assignee(id, auth.uid())
);

-- ===== Fix task_assignees policies (remove cross-table EXISTS that triggers recursion) =====
DROP POLICY IF EXISTS "Users can view task assignees" ON public.task_assignees;
DROP POLICY IF EXISTS "Task owners and managers can assign users" ON public.task_assignees;
DROP POLICY IF EXISTS "Task owners and managers can update assignees" ON public.task_assignees;
DROP POLICY IF EXISTS "Task owners and managers can remove assignees" ON public.task_assignees;

CREATE POLICY "Users can view task assignees"
ON public.task_assignees
FOR SELECT
USING (
  user_id = auth.uid()
  OR public.can_manage_task(task_id, auth.uid())
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'vp'::public.app_role)
  OR public.has_role(auth.uid(), 'manager'::public.app_role)
);

CREATE POLICY "Task owners and managers can assign users"
ON public.task_assignees
FOR INSERT
WITH CHECK (
  public.can_manage_task(task_id, auth.uid())
  AND assigned_by = auth.uid()
);

CREATE POLICY "Task owners and managers can update assignees"
ON public.task_assignees
FOR UPDATE
USING (public.can_manage_task(task_id, auth.uid()))
WITH CHECK (public.can_manage_task(task_id, auth.uid()));

CREATE POLICY "Task owners and managers can remove assignees"
ON public.task_assignees
FOR DELETE
USING (public.can_manage_task(task_id, auth.uid()));
