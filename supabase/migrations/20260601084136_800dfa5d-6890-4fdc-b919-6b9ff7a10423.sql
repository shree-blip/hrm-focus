-- Helper: can a viewer see leave evidence uploaded by a given user?
CREATE OR REPLACE FUNCTION public.can_view_leave_evidence(_viewer uuid, _uploader uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    _viewer = _uploader
    OR has_role(_viewer, 'admin'::app_role)
    OR has_role(_viewer, 'vp'::app_role)
    OR _uploader IN (SELECT public.get_all_subordinate_user_ids(_viewer))
$$;

-- Exclude Leave Evidence from the broad manager "manage general documents" policy
-- so managers outside the uploader's reporting line can't read it.
DROP POLICY IF EXISTS "Managers can manage general documents" ON public.documents;

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
  AND category IS DISTINCT FROM 'Leave Evidence'
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
  AND category IS DISTINCT FROM 'Leave Evidence'
);

-- Rebuild the main SELECT policy with a restricted Leave Evidence branch.
DROP POLICY IF EXISTS "Users can view documents" ON public.documents;

CREATE POLICY "Users can view documents"
ON public.documents
FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND (
    -- General documents (not Contracts, Compliance, or Leave Evidence): same org or no org
    (
      category IS DISTINCT FROM 'Contracts'
      AND category IS DISTINCT FROM 'Compliance'
      AND category IS DISTINCT FROM 'Leave Evidence'
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
    -- Compliance: ONLY uploader, assigned employee, admin, vp
    OR (
      category = 'Compliance'
      AND (
        uploaded_by = auth.uid()
        OR is_document_recipient(auth.uid(), employee_id)
        OR has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'vp'::app_role)
      )
    )
    -- Leave Evidence: ONLY uploader, their managers (line manager/supervisor chain), admin, vp
    OR (
      category = 'Leave Evidence'
      AND can_view_leave_evidence(auth.uid(), uploaded_by)
    )
  )
);