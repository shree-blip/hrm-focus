-- Drop and recreate the broken policies with correct syntax
DROP POLICY IF EXISTS "Users can view clients in their org" ON public.clients;
DROP POLICY IF EXISTS "Users can insert clients" ON public.clients;

-- Recreate with correct join
CREATE POLICY "Users can view clients in their org" ON public.clients FOR SELECT
USING (org_id IN (
  SELECT e.org_id FROM public.employees e
  JOIN public.profiles p ON e.profile_id = p.id
  WHERE p.user_id = auth.uid()
));

CREATE POLICY "Users can insert clients" ON public.clients FOR INSERT
WITH CHECK (org_id IN (
  SELECT e.org_id FROM public.employees e
  JOIN public.profiles p ON e.profile_id = p.id
  WHERE p.user_id = auth.uid()
));

-- Add remaining work_logs columns
ALTER TABLE public.work_logs ADD COLUMN IF NOT EXISTS start_time TIME;
ALTER TABLE public.work_logs ADD COLUMN IF NOT EXISTS end_time TIME;
ALTER TABLE public.work_logs ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'completed';

CREATE INDEX IF NOT EXISTS idx_work_logs_status ON public.work_logs(status);

-- Create client_alerts table
CREATE TABLE IF NOT EXISTS public.client_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  alert_type VARCHAR(50) NOT NULL DEFAULT 'info',
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  show_on_selection BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_client_alerts_client_id ON public.client_alerts(client_id);
CREATE INDEX IF NOT EXISTS idx_client_alerts_is_active ON public.client_alerts(is_active);

ALTER TABLE public.client_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view client alerts" ON public.client_alerts FOR SELECT
USING (org_id IN (
  SELECT e.org_id FROM public.employees e
  JOIN public.profiles p ON e.profile_id = p.id
  WHERE p.user_id = auth.uid()
));

CREATE POLICY "Managers can manage client alerts" ON public.client_alerts FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'vp'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Enable realtime for work_logs
ALTER PUBLICATION supabase_realtime ADD TABLE public.work_logs;