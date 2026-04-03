-- Allow admins/VPs to insert leave requests on behalf of employees
CREATE POLICY "Admins can create leave for any employee"
ON public.leave_requests
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'vp'::app_role)
);