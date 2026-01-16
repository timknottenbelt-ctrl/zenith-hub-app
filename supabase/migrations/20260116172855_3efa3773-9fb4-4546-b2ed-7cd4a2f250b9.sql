-- Drop existing restrictive policies for fda_projects
DROP POLICY IF EXISTS "Authenticated can read fda_projects" ON public.fda_projects;
DROP POLICY IF EXISTS "Authenticated can insert fda_projects" ON public.fda_projects;
DROP POLICY IF EXISTS "Authenticated can update fda_projects" ON public.fda_projects;
DROP POLICY IF EXISTS "Authenticated can delete fda_projects" ON public.fda_projects;

-- Create public access policies (for now, can be restricted later with auth)
CREATE POLICY "Public can read fda_projects"
ON public.fda_projects FOR SELECT
USING (true);

CREATE POLICY "Public can insert fda_projects"
ON public.fda_projects FOR INSERT
WITH CHECK (true);

CREATE POLICY "Public can update fda_projects"
ON public.fda_projects FOR UPDATE
USING (true);

CREATE POLICY "Public can delete fda_projects"
ON public.fda_projects FOR DELETE
USING (true);

-- Drop existing restrictive policies for fda_invoices
DROP POLICY IF EXISTS "Authenticated can read fda_invoices" ON public.fda_invoices;
DROP POLICY IF EXISTS "Authenticated can insert fda_invoices" ON public.fda_invoices;
DROP POLICY IF EXISTS "Authenticated can delete fda_invoices" ON public.fda_invoices;

-- Create public access policies
CREATE POLICY "Public can read fda_invoices"
ON public.fda_invoices FOR SELECT
USING (true);

CREATE POLICY "Public can insert fda_invoices"
ON public.fda_invoices FOR INSERT
WITH CHECK (true);

CREATE POLICY "Public can delete fda_invoices"
ON public.fda_invoices FOR DELETE
USING (true);