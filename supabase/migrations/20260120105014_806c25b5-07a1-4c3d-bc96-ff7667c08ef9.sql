-- Add Port Call Information columns to fda_projects
ALTER TABLE public.fda_projects 
ADD COLUMN IF NOT EXISTS vessel_arrived TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS vessel_sailed TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS operation TEXT,
ADD COLUMN IF NOT EXISTS commodity TEXT,
ADD COLUMN IF NOT EXISTS client_reference TEXT;