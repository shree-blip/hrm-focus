-- Restrict Compliance document visibility:
-- visible ONLY to uploader, assigned employee (recipient), admin, and vp.

-- 1) Stop managers/supervisors/manage_documents holders from SELECTing Compliance
--    via the broad "manage non-contract" policy. Exclude Compliance from it.
DROP POLICY IF EXISTS "Managers can manage non-contract documents" ON public.documents;

CREATE POLICY "Managers can manage general documents"
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
  AND category IS DISTINCT FROM 'Compliance'
)
WITH CHECK (
  (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'vp'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
    OR has_permission(auth.uid(), 'manage_documents')
  )
  AND category IS DISTINCT FROM 'Contracts'
  AND category IS DISTINCT FROM 'Compliance'
);

-- 2) Dedicated management policy for Compliance (uploader, admin, vp only)
DROP POLICY IF EXISTS "Manage compliance documents" ON public.documents;

CREATE POLICY "Manage compliance documents"
ON public.documents
FOR ALL
USING (
  category = 'Compliance'
  AND (
    uploaded_by = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'vp'::app_role)
  )
)
WITH CHECK (
  category = 'Compliance'
  AND (
    uploaded_by = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'vp'::app_role)
  )
);

-- 3) Update the main SELECT policy: Compliance gets a restricted branch.
DROP POLICY IF EXISTS "Users can view documents" ON public.documents;

CREATE POLICY "Users can view documents"
ON public.documents
FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND (
    -- General documents (not Contracts, not Compliance): same org or no org
    (
      category IS DISTINCT FROM 'Contracts'
      AND category IS DISTINCT FROM 'Compliance'
      AND ((org_id = get_user_org_id(auth.uid())) OR org_id IS NULL)
    )
    -- Contracts: ONLY uploader or assigned recipient
    OR (
      category = 'Contracts'
      AND (
        uploaded_by = auth.uid()
        OR is_document_recipient(auth.uid(), employee_id)
      )
    )
    -- Compliance: ONLY uploader, assigned employee (recipient), admin, vp
    OR (
      category = 'Compliance'
      AND (
        uploaded_by = auth.uid()
        OR is_document_recipient(auth.uid(), employee_id)
        OR has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'vp'::app_role)
      )
    )
  )
);