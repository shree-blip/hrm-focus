-- Allow line managers to update employees they manage (to add/remove from team)
CREATE POLICY "Line managers can update their direct reports"
ON public.employees
FOR UPDATE
USING (
  has_role(auth.uid(), 'line_manager'::app_role)
  AND (
    line_manager_id = get_employee_id_for_user(auth.uid())
    OR manager_id = get_employee_id_for_user(auth.uid())
    OR line_manager_id IS NULL
  )
);