-- Add pdf_path column to store uploaded PDF
ALTER TABLE public.manual_emails 
ADD COLUMN IF NOT EXISTS pdf_path text;