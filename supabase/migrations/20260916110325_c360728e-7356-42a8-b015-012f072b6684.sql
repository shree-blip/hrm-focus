DROP POLICY IF EXISTS "Line managers can update assigned requests" ON public.asset_requests;

CREATE POLICY "Managers and admins can update asset requests"
ON public.asset_requests
FOR UPDATE
TO authenticated
USING (
  first_approver_id = get_employee_id_for_user(auth.uid())
  OR requester_employee_id IN (
    SELECT get_all_subordinate_employee_ids(get_employee_id_for_user(auth.uid()))
  )
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'vp'::app_role)
)
WITH CHECK (
  first_approver_id = get_employee_id_for_user(auth.uid())
  OR requester_employee_id IN (
    SELECT get_all_subordinate_employee_ids(get_employee_id_for_user(auth.uid()))
  )
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'vp'::app_role)
);