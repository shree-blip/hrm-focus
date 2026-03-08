
-- Add UPDATE policy for users with edit_attendance permission
CREATE POLICY "Users with edit_attendance can update attendance logs"
ON public.attendance_logs
FOR UPDATE TO authenticated
USING (
  has_permission(auth.uid(), 'edit_attendance')
)
WITH CHECK (
  has_permission(auth.uid(), 'edit_attendance')
);
