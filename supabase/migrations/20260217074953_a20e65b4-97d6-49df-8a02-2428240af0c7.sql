-- Allow ALL authenticated users to SELECT attendance_logs for the realtime dashboard
-- This is a permissive policy so it grants access alongside existing policies
CREATE POLICY "All authenticated users can view attendance for realtime dashboard"
ON public.attendance_logs
FOR SELECT
TO authenticated
USING (true);
