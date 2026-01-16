-- Create FDA projects table
CREATE TABLE public.fda_projects (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    lbh_number TEXT NOT NULL,
    ship_name TEXT NOT NULL,
    fda_responsible TEXT,
    client TEXT,
    client_email TEXT,
    client_phone TEXT,
    billing_company TEXT,
    billing_address TEXT,
    billing_email TEXT,
    billing_phone TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    sent_at TIMESTAMP WITH TIME ZONE
);

-- Create FDA invoices/files table
CREATE TABLE public.fda_invoices (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    fda_project_id UUID NOT NULL REFERENCES public.fda_projects(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size BIGINT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.fda_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fda_invoices ENABLE ROW LEVEL SECURITY;

-- RLS Policies for fda_projects
CREATE POLICY "Authenticated can read fda_projects"
ON public.fda_projects FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated can insert fda_projects"
ON public.fda_projects FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated can update fda_projects"
ON public.fda_projects FOR UPDATE
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated can delete fda_projects"
ON public.fda_projects FOR DELETE
USING (auth.role() = 'authenticated');

-- RLS Policies for fda_invoices
CREATE POLICY "Authenticated can read fda_invoices"
ON public.fda_invoices FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated can insert fda_invoices"
ON public.fda_invoices FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated can delete fda_invoices"
ON public.fda_invoices FOR DELETE
USING (auth.role() = 'authenticated');

-- Trigger for updated_at
CREATE TRIGGER set_fda_projects_updated_at
    BEFORE UPDATE ON public.fda_projects
    FOR EACH ROW
    EXECUTE FUNCTION public.set_profiles_updated_at();