-- Allow documents to store a Google Drive link instead of an uploaded file
ALTER TABLE public.documents ALTER COLUMN file_path DROP NOT NULL;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS drive_link text;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS leave_request_id uuid;

-- Allow Leave Evidence owners (and management) to update/archive their own records
DROP POLICY IF EXISTS "Manage leave evidence documents" ON public.documents;
CREATE POLICY "Manage leave evidence documents"
ON public.documents
FOR UPDATE
USING (
  category = 'Leave Evidence'::text
  AND (
    uploaded_by = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'vp'::app_role)
  )
)
WITH CHECK (
  category = 'Leave Evidence'::text
  AND (
    uploaded_by = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'vp'::app_role)
  )
);