CREATE TABLE public.work_mode_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  employee_id uuid,
  attendance_log_id uuid REFERENCES public.attendance_logs(id) ON DELETE SET NULL,
  mode text NOT NULL CHECK (mode IN ('wfo','wfh')),
  applies_on date NOT NULL,
  recorded_at timestamp with time zone NOT NULL DEFAULT now(),
  recorded_by uuid,
  source text NOT NULL DEFAULT 'clock',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_work_mode_changes_user_date ON public.work_mode_changes (user_id, applies_on, recorded_at);
CREATE INDEX idx_work_mode_changes_log ON public.work_mode_changes (attendance_log_id);

GRANT SELECT, INSERT ON public.work_mode_changes TO authenticated;
GRANT ALL ON public.work_mode_changes TO service_role;

ALTER TABLE public.work_mode_changes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own work mode history"
ON public.work_mode_changes FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Management can view visible employees work mode history"
ON public.work_mode_changes FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'vp')
  OR (employee_id IS NOT NULL AND employee_id IN (SELECT public.get_visible_employee_ids(auth.uid())))
);

CREATE POLICY "Users can record their own work mode changes"
ON public.work_mode_changes FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());