
CREATE TABLE public.attendance_break_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_log_id UUID NOT NULL REFERENCES public.attendance_logs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  session_type TEXT NOT NULL CHECK (session_type IN ('break', 'pause')),
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  duration_minutes INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_break_sessions_attendance ON public.attendance_break_sessions(attendance_log_id);
CREATE INDEX idx_break_sessions_user ON public.attendance_break_sessions(user_id);

ALTER TABLE public.attendance_break_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own break sessions"
  ON public.attendance_break_sessions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can insert break sessions"
  ON public.attendance_break_sessions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());
