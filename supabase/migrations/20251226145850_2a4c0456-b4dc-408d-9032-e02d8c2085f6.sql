-- Create storage bucket for documents
INSERT INTO storage.buckets (id, name, public) 
VALUES ('documents', 'documents', true)
ON CONFLICT (id) DO NOTHING;

-- Create policies for document uploads
CREATE POLICY "Authenticated users can upload documents" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'documents' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can view documents" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'documents' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update their documents" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'documents' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete documents" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'documents' AND auth.uid() IS NOT NULL);