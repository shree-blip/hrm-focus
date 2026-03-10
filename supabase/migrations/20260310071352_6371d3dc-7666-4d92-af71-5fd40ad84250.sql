-- Allow employees to SELECT their own offboarding workflow
CREATE POLICY "Employees can view own offboarding"
  ON public.offboarding_workflows
  FOR SELECT
  USING (
    employee_id IN (
      SELECT e.id FROM public.employees e
      JOIN public.profiles p ON p.id = e.profile_id
      WHERE p.user_id = auth.uid()
    )
  );