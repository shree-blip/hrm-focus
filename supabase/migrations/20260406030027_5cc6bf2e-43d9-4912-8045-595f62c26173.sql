
CREATE TABLE public.leave_cancellation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leave_request_id UUID NOT NULL REFERENCES public.leave_requests(id) ON DELETE CASCADE,
  cancelled_by UUID NOT NULL,
  original_status TEXT NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.leave_cancellation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own cancellation logs"
  ON public.leave_cancellation_logs FOR SELECT TO authenticated
  USING (
    cancelled_by = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'vp'::public.app_role)
  );

CREATE POLICY "Authenticated users can insert cancellation logs"
  ON public.leave_cancellation_logs FOR INSERT TO authenticated
  WITH CHECK (cancelled_by = auth.uid());
