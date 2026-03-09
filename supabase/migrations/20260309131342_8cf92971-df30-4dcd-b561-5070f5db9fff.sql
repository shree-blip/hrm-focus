
-- Create promotion_requests table
CREATE TABLE public.promotion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  current_title text,
  current_salary numeric,
  new_title text NOT NULL,
  new_salary numeric NOT NULL,
  effective_date date NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create promotion_history table
CREATE TABLE public.promotion_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_request_id uuid REFERENCES public.promotion_requests(id),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  previous_title text,
  new_title text NOT NULL,
  previous_salary numeric,
  new_salary numeric NOT NULL,
  effective_date date NOT NULL,
  approved_by uuid REFERENCES auth.users(id),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.promotion_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotion_history ENABLE ROW LEVEL SECURITY;

-- RLS policies for promotion_requests
CREATE POLICY "Users can view own promotion requests" ON public.promotion_requests
  FOR SELECT TO authenticated
  USING (requested_by = auth.uid());

CREATE POLICY "VP and Admin can view all promotion requests" ON public.promotion_requests
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'vp'::app_role));

CREATE POLICY "Line managers can insert promotion requests" ON public.promotion_requests
  FOR INSERT TO authenticated
  WITH CHECK (requested_by = auth.uid() AND (has_role(auth.uid(), 'line_manager'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'vp'::app_role) OR has_role(auth.uid(), 'admin'::app_role)));

CREATE POLICY "VP and Admin can update promotion requests" ON public.promotion_requests
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'vp'::app_role));

-- RLS policies for promotion_history
CREATE POLICY "VP and Admin can view promotion history" ON public.promotion_history
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'vp'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "VP and Admin can insert promotion history" ON public.promotion_history
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'vp'::app_role));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.promotion_requests;
