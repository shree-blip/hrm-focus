
-- Fix calendar_events RLS: allow users with manage_calendar permission
DROP POLICY IF EXISTS "Managers can create calendar events" ON public.calendar_events;
CREATE POLICY "Managers can create calendar events" ON public.calendar_events
  FOR INSERT TO authenticated
  WITH CHECK (
    (created_by = auth.uid()) AND (
      has_role(auth.uid(), 'admin'::app_role) OR 
      has_role(auth.uid(), 'vp'::app_role) OR 
      has_role(auth.uid(), 'manager'::app_role) OR
      has_permission(auth.uid(), 'manage_calendar')
    )
  );

DROP POLICY IF EXISTS "Managers can delete calendar events" ON public.calendar_events;
CREATE POLICY "Managers can delete calendar events" ON public.calendar_events
  FOR DELETE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'vp'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role) OR
    has_permission(auth.uid(), 'manage_calendar')
  );

DROP POLICY IF EXISTS "Managers can update calendar events" ON public.calendar_events;
CREATE POLICY "Managers can update calendar events" ON public.calendar_events
  FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'vp'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role) OR
    has_permission(auth.uid(), 'manage_calendar')
  );

-- Fix documents RLS: allow users with manage_documents permission
DROP POLICY IF EXISTS "Managers can manage documents" ON public.documents;
CREATE POLICY "Managers can manage documents" ON public.documents
  FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'vp'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role) OR
    has_permission(auth.uid(), 'manage_documents')
  );
