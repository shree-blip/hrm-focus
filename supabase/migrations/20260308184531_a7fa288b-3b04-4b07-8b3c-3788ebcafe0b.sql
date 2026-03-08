
-- Create bug-screenshots storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('bug-screenshots', 'bug-screenshots', false)
ON CONFLICT (id) DO NOTHING;

-- Drop existing storage policies for bug-screenshots
DROP POLICY IF EXISTS "Users can upload bug screenshots" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own bug screenshots" ON storage.objects;
DROP POLICY IF EXISTS "Permitted users can view bug screenshots" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload bug screenshots" ON storage.objects;
DROP POLICY IF EXISTS "Bug screenshot upload" ON storage.objects;
DROP POLICY IF EXISTS "Bug screenshot view" ON storage.objects;

-- Allow authenticated users to upload screenshots to bug-screenshots bucket
CREATE POLICY "Bug screenshot upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'bug-screenshots' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow users to view their own screenshots
CREATE POLICY "Users can view own bug screenshots"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'bug-screenshots' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow users with view_bug_reports or manage_support permission to view ALL screenshots
CREATE POLICY "Permitted users can view bug screenshots"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'bug-screenshots' 
  AND (
    has_permission(auth.uid(), 'view_bug_reports')
    OR has_permission(auth.uid(), 'manage_support')
  )
);
