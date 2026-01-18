-- Create new FDA Creator table that doesn't overlap with n8n's fda_projects
CREATE TABLE public.fda_creator_projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lbh_number TEXT NOT NULL,
  ship_name TEXT NOT NULL,
  fda_responsible TEXT,
  client_name TEXT,
  client_email TEXT,
  client_phone TEXT,
  billing_company TEXT,
  billing_address TEXT,
  billing_email TEXT,
  billing_phone TEXT,
  status TEXT DEFAULT 'draft',
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.fda_creator_projects ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users full access
CREATE POLICY "Authenticated can read fda_creator_projects"
  ON public.fda_creator_projects FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated can insert fda_creator_projects"
  ON public.fda_creator_projects FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated can update fda_creator_projects"
  ON public.fda_creator_projects FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated can delete fda_creator_projects"
  ON public.fda_creator_projects FOR DELETE
  USING (auth.role() = 'authenticated');

-- Create invoices table for this new projects table
CREATE TABLE public.fda_creator_invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.fda_creator_projects(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT,
  invoice_number TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.fda_creator_invoices ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users full access
CREATE POLICY "Authenticated can read fda_creator_invoices"
  ON public.fda_creator_invoices FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated can insert fda_creator_invoices"
  ON public.fda_creator_invoices FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated can update fda_creator_invoices"
  ON public.fda_creator_invoices FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated can delete fda_creator_invoices"
  ON public.fda_creator_invoices FOR DELETE
  USING (auth.role() = 'authenticated');

-- Trigger for updated_at
CREATE TRIGGER update_fda_creator_projects_updated_at
  BEFORE UPDATE ON public.fda_creator_projects
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();