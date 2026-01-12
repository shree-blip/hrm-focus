-- Create work_logs table for daily work logging
CREATE TABLE public.work_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  task_description TEXT NOT NULL,
  time_spent_minutes INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX idx_work_logs_user_date ON public.work_logs(user_id, log_date);
CREATE INDEX idx_work_logs_employee_date ON public.work_logs(employee_id, log_date);
CREATE INDEX idx_work_logs_org_id ON public.work_logs(org_id);

-- Enable RLS
ALTER TABLE public.work_logs ENABLE ROW LEVEL SECURITY;

-- Users can view their own logs
CREATE POLICY "Users can view their own work logs"
ON public.work_logs
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own logs
CREATE POLICY "Users can insert their own work logs"
ON public.work_logs
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own logs
CREATE POLICY "Users can update their own work logs"
ON public.work_logs
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own logs
CREATE POLICY "Users can delete their own work logs"
ON public.work_logs
FOR DELETE
USING (auth.uid() = user_id);

-- VP and Admin can view all logs in their org
CREATE POLICY "VP and Admin can view all work logs"
ON public.work_logs
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'vp'::app_role) OR
  has_role(auth.uid(), 'manager'::app_role)
);

-- Line managers can view their direct reports' logs
CREATE POLICY "Line managers can view direct reports work logs"
ON public.work_logs
FOR SELECT
USING (
  employee_id IN (
    SELECT id FROM public.employees 
    WHERE line_manager_id = get_employee_id_for_user(auth.uid())
    OR manager_id = get_employee_id_for_user(auth.uid())
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_work_logs_updated_at
BEFORE UPDATE ON public.work_logs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();