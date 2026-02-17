-- Allow all authenticated users to view active employees for realtime attendance widget
CREATE POLICY "All authenticated users can view employees for realtime attendance"
ON public.employees
FOR SELECT
TO authenticated
USING (status = 'active');
