
-- Create attendance_adjustment_requests table
CREATE TABLE IF NOT EXISTS public.attendance_adjustment_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  attendance_log_id UUID NOT NULL REFERENCES public.attendance_logs(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reviewer_id UUID REFERENCES auth.users(id),
  proposed_clock_in TIMESTAMPTZ,
  proposed_clock_out TIMESTAMPTZ,
  proposed_break_minutes INTEGER,
  proposed_pause_minutes INTEGER,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewer_comment TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.attendance_adjustment_requests ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own requests
CREATE POLICY "Users can view own adjustment requests"
  ON public.attendance_adjustment_requests
  FOR SELECT
  TO authenticated
  USING (requested_by = auth.uid());

-- Policy: Managers/VP/Admin can view all requests
CREATE POLICY "Management can view all adjustment requests"
  ON public.attendance_adjustment_requests
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'vp'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
    OR public.is_line_manager(auth.uid())
  );

-- Policy: Authenticated users can insert their own requests
CREATE POLICY "Users can create own adjustment requests"
  ON public.attendance_adjustment_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (requested_by = auth.uid());

-- Policy: Managers/VP/Admin can update (review) requests
CREATE POLICY "Management can update adjustment requests"
  ON public.attendance_adjustment_requests
  FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'vp'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
    OR public.is_line_manager(auth.uid())
  );

-- Enable realtime for the table
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_adjustment_requests;

-- Create trigger to auto-apply approved adjustments to attendance_logs
CREATE OR REPLACE FUNCTION public.apply_attendance_adjustment()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
    UPDATE public.attendance_logs
    SET
      clock_in = COALESCE(NEW.proposed_clock_in, clock_in),
      clock_out = COALESCE(NEW.proposed_clock_out, clock_out),
      total_break_minutes = COALESCE(NEW.proposed_break_minutes, total_break_minutes),
      total_pause_minutes = COALESCE(NEW.proposed_pause_minutes, total_pause_minutes),
      is_edited = true
    WHERE id = NEW.attendance_log_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_apply_attendance_adjustment
  AFTER UPDATE ON public.attendance_adjustment_requests
  FOR EACH ROW
  WHEN (NEW.status = 'approved' AND OLD.status = 'pending')
  EXECUTE FUNCTION public.apply_attendance_adjustment();

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_adj_requests_requested_by ON public.attendance_adjustment_requests(requested_by);
CREATE INDEX IF NOT EXISTS idx_adj_requests_status ON public.attendance_adjustment_requests(status);
CREATE INDEX IF NOT EXISTS idx_adj_requests_attendance_log_id ON public.attendance_adjustment_requests(attendance_log_id);
