-- Drop conflicting insert policies for clients
DROP POLICY IF EXISTS "Users can insert clients" ON public.clients;
DROP POLICY IF EXISTS "Managers and above can create clients" ON public.clients;

-- Create a simpler insert policy that allows authenticated users to create clients
CREATE POLICY "Authenticated users can create clients"
ON public.clients FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid());

-- Also ensure the select policy works for clients the user created
DROP POLICY IF EXISTS "Users can view clients in their org" ON public.clients;
CREATE POLICY "Users can view clients"
ON public.clients FOR SELECT
TO authenticated
USING (
  created_by = auth.uid()
  OR org_id IN (
    SELECT e.org_id FROM employees e
    JOIN profiles p ON e.profile_id = p.id
    WHERE p.user_id = auth.uid()
  )
  OR org_id IS NULL
);