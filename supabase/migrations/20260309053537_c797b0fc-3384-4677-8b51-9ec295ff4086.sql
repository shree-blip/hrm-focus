
DROP POLICY IF EXISTS "All authenticated users can view employees for realtime attenda" ON public.employees;

CREATE POLICY "All authenticated users can view employees for realtime attenda"
ON public.employees
FOR SELECT
TO authenticated
USING (status IN ('active', 'probation'));
