
-- Helper: check if current user is the assigned employee on a document
CREATE OR REPLACE FUNCTION public.is_document_recipient(_user_id uuid, _employee_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.employees e
    JOIN public.profiles p ON e.profile_id = p.id
    WHERE p.user_id = _user_id
      AND e.id = _employee_id
  )
$$;

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Users can view org documents" ON public.documents;

-- Drop existing ALL policy for managers (it grants SELECT too)
DROP POLICY IF EXISTS "Managers can manage documents" ON public.documents;

-- New SELECT policy: contracts locked to uploader + recipient only
CREATE POLICY "Users can view documents"
ON public.documents
FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND (
    -- Non-contract documents: same org or no org
    (
      category IS DISTINCT FROM 'Contracts'
      AND ((org_id = get_user_org_id(auth.uid())) OR org_id IS NULL)
    )
    -- Contract documents: ONLY uploader or assigned recipient
    OR (
      category = 'Contracts'
      AND (
        uploaded_by = auth.uid()
        OR is_document_recipient(auth.uid(), employee_id)
      )
    )
  )
);

-- Managers can manage NON-contract documents (insert/update/delete)
CREATE POLICY "Managers can manage non-contract documents"
ON public.documents
FOR ALL
USING (
  (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'vp'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
    OR has_permission(auth.uid(), 'manage_documents')
  )
  AND category IS DISTINCT FROM 'Contracts'
)
WITH CHECK (
  (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'vp'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
    OR has_permission(auth.uid(), 'manage_documents')
  )
  AND category IS DISTINCT FROM 'Contracts'
);

-- Contract owners can manage their own contracts
CREATE POLICY "Contract owners can manage their contracts"
ON public.documents
FOR ALL
USING (
  category = 'Contracts'
  AND uploaded_by = auth.uid()
)
WITH CHECK (
  category = 'Contracts'
  AND uploaded_by = auth.uid()
);
