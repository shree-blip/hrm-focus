
CREATE TABLE public.overtime_bank (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
  payroll_run_id UUID REFERENCES public.payroll_runs(id) ON DELETE SET NULL,
  period_month INTEGER NOT NULL,
  period_year INTEGER NOT NULL,
  standard_hours NUMERIC NOT NULL DEFAULT 0,
  actual_hours NUMERIC NOT NULL DEFAULT 0,
  extra_hours NUMERIC NOT NULL DEFAULT 0,
  converted_to_leave BOOLEAN NOT NULL DEFAULT false,
  leave_days_converted NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, period_month, period_year)
);

ALTER TABLE public.overtime_bank ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own overtime" ON public.overtime_bank
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "VP and Admin can view all overtime" ON public.overtime_bank
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'vp'::app_role));

CREATE POLICY "VP and Admin can insert overtime" ON public.overtime_bank
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'vp'::app_role));

CREATE POLICY "VP and Admin can update overtime" ON public.overtime_bank
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'vp'::app_role));
