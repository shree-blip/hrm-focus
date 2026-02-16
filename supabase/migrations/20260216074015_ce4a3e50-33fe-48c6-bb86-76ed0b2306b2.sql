
-- Fix: Add supervisor to the SELECT policy so they can see team requests
DROP POLICY IF EXISTS "Users can view org leave requests" ON public.leave_requests;

CREATE POLICY "Users can view org leave requests"
ON public.leave_requests
FOR SELECT
TO authenticated
USING (
  ((org_id = get_user_org_id(auth.uid())) OR (org_id IS NULL))
  AND (
    user_id = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'vp'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
    OR has_role(auth.uid(), 'line_manager'::app_role)
    OR has_role(auth.uid(), 'supervisor'::app_role)
  )
);
