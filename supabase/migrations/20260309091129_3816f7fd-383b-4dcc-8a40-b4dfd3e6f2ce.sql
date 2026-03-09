
CREATE TABLE public.payroll_run_details (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payroll_run_id UUID NOT NULL REFERENCES public.payroll_runs(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  user_id UUID,
  employee_name TEXT NOT NULL,
  department TEXT,
  hourly_rate NUMERIC DEFAULT 0,
  actual_hours NUMERIC DEFAULT 0,
  payable_hours NUMERIC DEFAULT 0,
  extra_hours NUMERIC DEFAULT 0,
  gross_pay NUMERIC DEFAULT 0,
  deductions NUMERIC DEFAULT 0,
  net_pay NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.payroll_run_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "VP and Admin can view payroll details" ON public.payroll_run_details
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'vp'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "VP and Admin can insert payroll details" ON public.payroll_run_details
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'vp'::app_role));
