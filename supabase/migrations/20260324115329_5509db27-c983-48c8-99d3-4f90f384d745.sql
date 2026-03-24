
-- Drop and recreate the team_members management policy to include manager and line_manager roles
DROP POLICY IF EXISTS "Managers can manage their team_members" ON public.team_members;

CREATE POLICY "Managers can manage their team_members"
ON public.team_members
FOR ALL
TO authenticated
USING (
  manager_employee_id = get_employee_id_for_user(auth.uid())
  OR has_role(auth.uid(), 'vp'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role)
  OR has_role(auth.uid(), 'line_manager'::app_role)
  OR has_role(auth.uid(), 'supervisor'::app_role)
)
WITH CHECK (
  manager_employee_id = get_employee_id_for_user(auth.uid())
  OR has_role(auth.uid(), 'vp'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role)
  OR has_role(auth.uid(), 'line_manager'::app_role)
  OR has_role(auth.uid(), 'supervisor'::app_role)
);
