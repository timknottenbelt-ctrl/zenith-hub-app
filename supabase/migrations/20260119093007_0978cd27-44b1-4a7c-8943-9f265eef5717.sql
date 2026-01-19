-- Add new columns to fda_projects for FDA Front Page functionality
ALTER TABLE public.fda_projects 
ADD COLUMN IF NOT EXISTS front_page_url text,
ADD COLUMN IF NOT EXISTS agency_cost_url text;

-- Create storage bucket for FDA front pages
INSERT INTO storage.buckets (id, name, public)
VALUES ('fda-front-pages', 'fda-front-pages', false)
ON CONFLICT (id) DO NOTHING;

-- Create storage bucket for FDA agency costs
INSERT INTO storage.buckets (id, name, public)
VALUES ('fda-agency-costs', 'fda-agency-costs', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for fda-front-pages bucket
CREATE POLICY "Authenticated can upload fda-front-pages"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'fda-front-pages');

CREATE POLICY "Authenticated can read fda-front-pages"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'fda-front-pages');

CREATE POLICY "Authenticated can delete fda-front-pages"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'fda-front-pages');

-- RLS policies for fda-agency-costs bucket
CREATE POLICY "Authenticated can upload fda-agency-costs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'fda-agency-costs');

CREATE POLICY "Authenticated can read fda-agency-costs"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'fda-agency-costs');

CREATE POLICY "Authenticated can delete fda-agency-costs"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'fda-agency-costs');