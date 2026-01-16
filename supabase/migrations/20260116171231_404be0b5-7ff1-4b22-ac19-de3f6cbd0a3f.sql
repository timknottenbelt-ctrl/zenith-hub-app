-- Create storage bucket for knowledge PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('knowledge-pdfs', 'knowledge-pdfs', false)
ON CONFLICT (id) DO NOTHING;

-- Create policies for knowledge-pdfs bucket
CREATE POLICY "Authenticated users can read knowledge files"
ON storage.objects
FOR SELECT
USING (bucket_id = 'knowledge-pdfs' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can upload knowledge files"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'knowledge-pdfs' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete knowledge files"
ON storage.objects
FOR DELETE
USING (bucket_id = 'knowledge-pdfs' AND auth.role() = 'authenticated');

-- Create storage bucket for FDA invoices
INSERT INTO storage.buckets (id, name, public)
VALUES ('fda-invoices', 'fda-invoices', false)
ON CONFLICT (id) DO NOTHING;

-- Create policies for fda-invoices bucket
CREATE POLICY "Authenticated users can read fda invoices"
ON storage.objects
FOR SELECT
USING (bucket_id = 'fda-invoices' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can upload fda invoices"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'fda-invoices' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete fda invoices"
ON storage.objects
FOR DELETE
USING (bucket_id = 'fda-invoices' AND auth.role() = 'authenticated');

-- Create storage bucket for profile avatars
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Create policies for avatars bucket (public read, authenticated upload)
CREATE POLICY "Avatar images are publicly accessible"
ON storage.objects
FOR SELECT
USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update their own avatar"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'avatars' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete their own avatar"
ON storage.objects
FOR DELETE
USING (bucket_id = 'avatars' AND auth.role() = 'authenticated');

-- Create knowledge_files table for tracking uploaded PDFs
CREATE TABLE IF NOT EXISTS public.knowledge_files (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    type TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.knowledge_files ENABLE ROW LEVEL SECURITY;

-- Create policies for knowledge_files
CREATE POLICY "Authenticated can read knowledge_files"
ON public.knowledge_files
FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated can insert knowledge_files"
ON public.knowledge_files
FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated can delete knowledge_files"
ON public.knowledge_files
FOR DELETE
USING (auth.role() = 'authenticated');

-- Add avatar_url column to profiles if not exists
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;