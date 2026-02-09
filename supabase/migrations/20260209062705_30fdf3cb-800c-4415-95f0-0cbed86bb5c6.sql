
-- Create calendar_events table for custom events added by managers/admins/VPs
CREATE TABLE public.calendar_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  event_date DATE NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'event', -- 'event', 'reminder', 'deadline'
  created_by UUID NOT NULL,
  org_id UUID REFERENCES public.organizations(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  reminder_sent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

-- All authenticated users in the org can view calendar events
CREATE POLICY "Users can view org calendar events"
ON public.calendar_events
FOR SELECT
USING (
  (org_id = get_user_org_id(auth.uid()) OR org_id IS NULL)
  AND auth.uid() IS NOT NULL
);

-- Only managers, admins, VPs can create events
CREATE POLICY "Managers can create calendar events"
ON public.calendar_events
FOR INSERT
WITH CHECK (
  created_by = auth.uid()
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'vp'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
);

-- Only managers, admins, VPs can update events
CREATE POLICY "Managers can update calendar events"
ON public.calendar_events
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'vp'::app_role) OR has_role(auth.uid(), 'manager'::app_role)
);

-- Only managers, admins, VPs can delete events
CREATE POLICY "Managers can delete calendar events"
ON public.calendar_events
FOR DELETE
USING (
  has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'vp'::app_role) OR has_role(auth.uid(), 'manager'::app_role)
);

-- Trigger for updated_at
CREATE TRIGGER update_calendar_events_updated_at
BEFORE UPDATE ON public.calendar_events
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
