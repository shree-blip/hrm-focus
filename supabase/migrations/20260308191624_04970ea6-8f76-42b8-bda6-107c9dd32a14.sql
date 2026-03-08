
-- Drop existing restrictive policies
DROP POLICY IF EXISTS "VP and Admin can insert attendance edit logs" ON public.attendance_edit_logs;
DROP POLICY IF EXISTS "VP and Admin can view attendance edit logs" ON public.attendance_edit_logs;

-- Recreate with permission-aware policies
CREATE POLICY "Users with edit_attendance can insert audit logs"
ON public.attendance_edit_logs
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'vp'::app_role)
  OR has_permission(auth.uid(), 'edit_attendance')
);

CREATE POLICY "Users with edit_attendance can view audit logs"
ON public.attendance_edit_logs
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'vp'::app_role)
  OR has_permission(auth.uid(), 'edit_attendance')
);
