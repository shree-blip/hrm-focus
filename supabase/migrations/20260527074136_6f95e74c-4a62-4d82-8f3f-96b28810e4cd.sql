DROP POLICY IF EXISTS "Supervisors and line managers can update team requests" ON public.leave_requests;

CREATE POLICY "Supervisors and line managers can update team requests"
ON public.leave_requests
FOR UPDATE
USING (
  (status IN ('pending', 'approved'))
  AND (user_id IN (SELECT get_all_subordinate_user_ids(auth.uid())))
)
WITH CHECK (true);