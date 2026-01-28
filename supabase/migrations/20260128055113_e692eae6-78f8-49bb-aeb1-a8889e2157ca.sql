-- Drop the restrictive policy
DROP POLICY IF EXISTS "Users can view org documents" ON public.documents;

-- Create a new policy that allows all authenticated users to view documents in their org
-- Private category filtering is handled in the frontend hook
CREATE POLICY "Users can view org documents"
ON public.documents
FOR SELECT
USING (
  (org_id = get_user_org_id(auth.uid()) OR org_id IS NULL)
  AND auth.uid() IS NOT NULL
);