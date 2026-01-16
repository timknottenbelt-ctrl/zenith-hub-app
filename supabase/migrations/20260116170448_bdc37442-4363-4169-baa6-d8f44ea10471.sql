-- Enable RLS on vessels table
ALTER TABLE public.vessels ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read vessels (public data)
CREATE POLICY "Vessels are publicly readable"
ON public.vessels
FOR SELECT
USING (true);

-- Allow authenticated users to insert/update/delete vessels
CREATE POLICY "Authenticated users can insert vessels"
ON public.vessels
FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update vessels"
ON public.vessels
FOR UPDATE
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete vessels"
ON public.vessels
FOR DELETE
USING (auth.role() = 'authenticated');

-- Enable RLS on email table
ALTER TABLE public.email ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read emails (for now - can be restricted later)
CREATE POLICY "Emails are publicly readable"
ON public.email
FOR SELECT
USING (true);

-- Allow authenticated users to modify emails
CREATE POLICY "Authenticated users can update emails"
ON public.email
FOR UPDATE
USING (auth.role() = 'authenticated');

-- Enable RLS on curacao_knowledge table
ALTER TABLE public.curacao_knowledge ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Knowledge is publicly readable"
ON public.curacao_knowledge
FOR SELECT
USING (true);

-- Enable RLS on Admin_mail table
ALTER TABLE public."Admin_mail" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin mail readable by authenticated"
ON public."Admin_mail"
FOR SELECT
USING (auth.role() = 'authenticated');

-- Enable RLS on linksss table
ALTER TABLE public.linksss ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Links publicly readable"
ON public.linksss
FOR SELECT
USING (true);