-- Create storage policies for knowledge-pdfs bucket
CREATE POLICY "Public can upload to knowledge-pdfs bucket"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'knowledge-pdfs');

CREATE POLICY "Public can read from knowledge-pdfs bucket"
ON storage.objects FOR SELECT
USING (bucket_id = 'knowledge-pdfs');

CREATE POLICY "Public can delete from knowledge-pdfs bucket"
ON storage.objects FOR DELETE
USING (bucket_id = 'knowledge-pdfs');

-- Create storage policies for fda-invoices bucket
CREATE POLICY "Public can upload to fda-invoices bucket"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'fda-invoices');

CREATE POLICY "Public can read from fda-invoices bucket"
ON storage.objects FOR SELECT
USING (bucket_id = 'fda-invoices');

CREATE POLICY "Public can delete from fda-invoices bucket"
ON storage.objects FOR DELETE
USING (bucket_id = 'fda-invoices');