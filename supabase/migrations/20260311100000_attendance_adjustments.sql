-- Attendance Adjustment Requests
-- Employees request corrections; line managers approve/reject.
-- On approval the attendance_logs row is updated automatically via trigger.
--
-- This migration is safe to run even if the table already exists
-- (it was first created in 20260309192516). We add missing columns,
-- replace RLS policies with proper team-scoped versions, and ensure
-- the approval trigger applies field-level updates + writes audit logs.

-- 1. Create table only if it doesn't already exist
CREATE TABLE IF NOT EXISTS public.attendance_adjustment_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_log_id UUID NOT NULL REFERENCES public.attendance_logs(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reviewer_id UUID REFERENCES auth.users(id),
  proposed_clock_in TIMESTAMPTZ,
  proposed_clock_out TIMESTAMPTZ,
  proposed_break_minutes INTEGER,
  proposed_pause_minutes INTEGER,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewer_comment TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add updated_at column if missing (original migration didn't have it)
ALTER TABLE public.attendance_adjustment_requests
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Create indexes idempotently
CREATE INDEX IF NOT EXISTS idx_adj_req_attendance ON public.attendance_adjustment_requests(attendance_log_id);
CREATE INDEX IF NOT EXISTS idx_adj_req_status ON public.attendance_adjustment_requests(status);
CREATE INDEX IF NOT EXISTS idx_adj_req_requested_by ON public.attendance_adjustment_requests(requested_by);

-- Enable RLS
ALTER TABLE public.attendance_adjustment_requests ENABLE ROW LEVEL SECURITY;

-- 2. Drop old policies and recreate with proper team-scoped access
DROP POLICY IF EXISTS "Users can view own adjustment requests" ON public.attendance_adjustment_requests;
DROP POLICY IF EXISTS "Management can view all adjustment requests" ON public.attendance_adjustment_requests;
DROP POLICY IF EXISTS "Users can create own adjustment requests" ON public.attendance_adjustment_requests;
DROP POLICY IF EXISTS "Management can update adjustment requests" ON public.attendance_adjustment_requests;
DROP POLICY IF EXISTS "Managers can view team adjustment requests" ON public.attendance_adjustment_requests;
DROP POLICY IF EXISTS "Managers can update adjustment requests" ON public.attendance_adjustment_requests;

-- Employees can view their own requests
CREATE POLICY "Users can view own adjustment requests"
ON public.attendance_adjustment_requests FOR SELECT
USING (requested_by = auth.uid());

-- Employees can create requests for their own attendance logs
CREATE POLICY "Users can create own adjustment requests"
ON public.attendance_adjustment_requests FOR INSERT
WITH CHECK (
  requested_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.attendance_logs al
    WHERE al.id = attendance_log_id AND al.user_id = auth.uid()
  )
);

-- Line managers / managers / VP / admin can view adjustment requests for their reports
-- Checks both line_manager_id AND manager_id relationships
CREATE POLICY "Managers can view team adjustment requests"
ON public.attendance_adjustment_requests FOR SELECT
USING (
  -- Line manager or manager: check via employee relationship
  EXISTS (
    SELECT 1 FROM public.attendance_logs al
    JOIN public.employees emp ON emp.id = al.employee_id
    JOIN public.profiles p ON p.id IN (
      SELECT mgr.profile_id FROM public.employees mgr
      WHERE mgr.id = emp.line_manager_id OR mgr.id = emp.manager_id
    )
    WHERE al.id = attendance_log_id AND p.user_id = auth.uid()
  )
  OR has_role(auth.uid(), 'manager'::app_role)
  OR has_role(auth.uid(), 'vp'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Only managers/VP/admin/line managers can update (approve/reject)
CREATE POLICY "Managers can update adjustment requests"
ON public.attendance_adjustment_requests FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.attendance_logs al
    JOIN public.employees emp ON emp.id = al.employee_id
    JOIN public.profiles p ON p.id IN (
      SELECT mgr.profile_id FROM public.employees mgr
      WHERE mgr.id = emp.line_manager_id OR mgr.id = emp.manager_id
    )
    WHERE al.id = attendance_log_id AND p.user_id = auth.uid()
  )
  OR has_role(auth.uid(), 'manager'::app_role)
  OR has_role(auth.uid(), 'vp'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Enable realtime (ignore if already added)
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_adjustment_requests;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Trigger: on approval, update the attendance_logs row with proposed values
CREATE OR REPLACE FUNCTION public.apply_attendance_adjustment()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_values JSONB;
  v_new_values JSONB;
  v_log RECORD;
BEGIN
  -- Only act when status changes to 'approved'
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    -- Fetch current log values for audit
    SELECT * INTO v_log FROM attendance_logs WHERE id = NEW.attendance_log_id;

    v_old_values := jsonb_build_object(
      'clock_in', v_log.clock_in,
      'clock_out', v_log.clock_out,
      'total_break_minutes', v_log.total_break_minutes,
      'total_pause_minutes', v_log.total_pause_minutes
    );

    -- Apply proposed values
    UPDATE attendance_logs SET
      clock_in = COALESCE(NEW.proposed_clock_in, clock_in),
      clock_out = COALESCE(NEW.proposed_clock_out, clock_out),
      total_break_minutes = COALESCE(NEW.proposed_break_minutes, total_break_minutes),
      total_pause_minutes = COALESCE(NEW.proposed_pause_minutes, total_pause_minutes),
      is_edited = true,
      status = CASE
        WHEN COALESCE(NEW.proposed_clock_out, v_log.clock_out) IS NOT NULL THEN 'completed'
        ELSE status
      END
    WHERE id = NEW.attendance_log_id;

    v_new_values := jsonb_build_object(
      'clock_in', COALESCE(NEW.proposed_clock_in, v_log.clock_in),
      'clock_out', COALESCE(NEW.proposed_clock_out, v_log.clock_out),
      'total_break_minutes', COALESCE(NEW.proposed_break_minutes, v_log.total_break_minutes),
      'total_pause_minutes', COALESCE(NEW.proposed_pause_minutes, v_log.total_pause_minutes)
    );

    -- Write audit log
    INSERT INTO attendance_edit_logs (attendance_id, edited_by, old_values, new_values, reason)
    VALUES (NEW.attendance_log_id, NEW.reviewer_id, v_old_values, v_new_values, NEW.reason);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_apply_attendance_adjustment
  BEFORE UPDATE ON public.attendance_adjustment_requests
  FOR EACH ROW EXECUTE FUNCTION public.apply_attendance_adjustment();
