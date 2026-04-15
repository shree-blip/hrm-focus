-- Fix task_checklists: replace USING(true) with proper access control
DROP POLICY IF EXISTS "Authenticated users can manage checklists" ON public.task_checklists;

CREATE POLICY "Task participants can manage checklists" ON public.task_checklists
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_checklists.task_id
      AND (
        t.created_by = auth.uid()
        OR t.assignee_id = auth.uid()
        OR public.is_task_assignee(t.id, auth.uid())
        OR public.has_role(auth.uid(), 'admin'::public.app_role)
        OR public.has_role(auth.uid(), 'vp'::public.app_role)
        OR public.has_role(auth.uid(), 'supervisor'::public.app_role)
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_checklists.task_id
      AND (
        t.created_by = auth.uid()
        OR t.assignee_id = auth.uid()
        OR public.is_task_assignee(t.id, auth.uid())
        OR public.has_role(auth.uid(), 'admin'::public.app_role)
        OR public.has_role(auth.uid(), 'vp'::public.app_role)
        OR public.has_role(auth.uid(), 'supervisor'::public.app_role)
      )
    )
  );

-- Fix grievance-attachments storage: restrict downloads to grievance participants
DROP POLICY IF EXISTS "Users can view grievance attachments" ON storage.objects;

CREATE POLICY "Users can view grievance attachments" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'grievance-attachments'
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.grievance_attachments ga
      WHERE ga.file_path = name
      AND public.can_view_grievance(auth.uid(), ga.grievance_id)
    )
  );