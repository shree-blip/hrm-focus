
CREATE POLICY "Managers can view team balances"
ON public.leave_balances
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'vp'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role)
  OR (
    has_role(auth.uid(), 'supervisor'::app_role)
    AND user_id IN (
      SELECT public.get_all_subordinate_user_ids(auth.uid())
    )
  )
  OR (
    has_role(auth.uid(), 'line_manager'::app_role)
    AND user_id IN (
      SELECT public.get_all_subordinate_user_ids(auth.uid())
    )
  )
);
