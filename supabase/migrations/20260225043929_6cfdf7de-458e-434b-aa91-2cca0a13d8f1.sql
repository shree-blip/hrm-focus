
-- Create attendance edit audit log table
CREATE TABLE public.attendance_edit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id uuid NOT NULL,
  edited_by uuid NOT NULL,
  old_values jsonb NOT NULL,
  new_values jsonb NOT NULL,
  reason text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.attendance_edit_logs ENABLE ROW LEVEL SECURITY;

-- VP and Admin can insert audit logs
CREATE POLICY "VP and Admin can insert attendance edit logs"
  ON public.attendance_edit_logs
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'vp'::app_role));

-- VP and Admin can view audit logs
CREATE POLICY "VP and Admin can view attendance edit logs"
  ON public.attendance_edit_logs
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'vp'::app_role));

-- Add is_edited flag to attendance_logs
ALTER TABLE public.attendance_logs ADD COLUMN IF NOT EXISTS is_edited boolean DEFAULT false;

-- Enable realtime for audit logs
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_edit_logs;
