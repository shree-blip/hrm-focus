-- Make avatars bucket private for security
UPDATE storage.buckets SET public = false WHERE id = 'avatars';

-- Drop the public access policy
DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;

-- Create authenticated-only view policy
CREATE POLICY "Authenticated users can view avatars"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'avatars' AND 
  auth.uid() IS NOT NULL
);