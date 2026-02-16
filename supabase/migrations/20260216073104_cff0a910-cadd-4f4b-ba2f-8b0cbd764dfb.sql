
-- Allow supervisors and line managers to update leave requests (approve/reject)
CREATE POLICY "Supervisors and line managers can update team requests"
ON public.leave_requests
FOR UPDATE
USING (
  has_role(auth.uid(), 'supervisor'::app_role) 
  OR has_role(auth.uid(), 'line_manager'::app_role)
);
