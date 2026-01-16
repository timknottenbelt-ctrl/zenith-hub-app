-- Drop existing restrictive policies for contacts
DROP POLICY IF EXISTS "Contacts delete" ON public.contacts;
DROP POLICY IF EXISTS "Contacts insert" ON public.contacts;
DROP POLICY IF EXISTS "Contacts read" ON public.contacts;
DROP POLICY IF EXISTS "Contacts update" ON public.contacts;

-- Create public access policies
CREATE POLICY "Public can read contacts"
ON public.contacts FOR SELECT
USING (true);

CREATE POLICY "Public can insert contacts"
ON public.contacts FOR INSERT
WITH CHECK (true);

CREATE POLICY "Public can update contacts"
ON public.contacts FOR UPDATE
USING (true);

CREATE POLICY "Public can delete contacts"
ON public.contacts FOR DELETE
USING (true);