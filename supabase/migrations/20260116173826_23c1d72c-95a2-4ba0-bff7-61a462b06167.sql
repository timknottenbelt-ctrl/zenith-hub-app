-- Create email_attachments table for storing PDF attachments per email
CREATE TABLE public.email_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email_id BIGINT NOT NULL REFERENCES public.email(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_attachments ENABLE ROW LEVEL SECURITY;

-- Create public access policies (matching email table)
CREATE POLICY "Public can read email_attachments"
ON public.email_attachments FOR SELECT
USING (true);

CREATE POLICY "Public can insert email_attachments"
ON public.email_attachments FOR INSERT
WITH CHECK (true);

CREATE POLICY "Public can delete email_attachments"
ON public.email_attachments FOR DELETE
USING (true);