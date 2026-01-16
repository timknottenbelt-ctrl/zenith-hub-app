-- Create storage policies for pdfs bucket to allow uploads
CREATE POLICY "Public can upload to pdfs bucket"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'pdfs');

CREATE POLICY "Public can read from pdfs bucket"
ON storage.objects FOR SELECT
USING (bucket_id = 'pdfs');

CREATE POLICY "Public can delete from pdfs bucket"
ON storage.objects FOR DELETE
USING (bucket_id = 'pdfs');