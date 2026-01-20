-- Create clients table for client management
CREATE TABLE public.clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on clients
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- RLS policies for clients - employees can view, managers+ can create
CREATE POLICY "Users can view clients in their org" 
ON public.clients FOR SELECT 
USING (
  org_id IN (
    SELECT org_id FROM public.employees WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
  )
  OR org_id IS NULL
);

CREATE POLICY "Managers and above can create clients" 
ON public.clients FOR INSERT 
WITH CHECK (
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'vp'::app_role)
);

CREATE POLICY "Managers and above can update clients" 
ON public.clients FOR UPDATE 
USING (
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'vp'::app_role)
);

-- Add client_id and department to work_logs
ALTER TABLE public.work_logs 
ADD COLUMN client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
ADD COLUMN department TEXT;

-- Create index for faster queries
CREATE INDEX idx_work_logs_client_id ON public.work_logs(client_id);
CREATE INDEX idx_work_logs_department ON public.work_logs(department);
CREATE INDEX idx_work_logs_log_date ON public.work_logs(log_date);
CREATE INDEX idx_clients_org_id ON public.clients(org_id);

-- Trigger for clients updated_at
CREATE TRIGGER update_clients_updated_at
BEFORE UPDATE ON public.clients
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();