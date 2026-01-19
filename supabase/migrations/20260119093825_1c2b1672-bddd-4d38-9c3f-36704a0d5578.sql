-- Add INSERT policy for authenticated users on fda_projects
CREATE POLICY "Authenticated can insert fda_projects"
ON public.fda_projects
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Add UPDATE policy for authenticated users on fda_projects
CREATE POLICY "Authenticated can update fda_projects"
ON public.fda_projects
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Add DELETE policy for authenticated users on fda_projects
CREATE POLICY "Authenticated can delete fda_projects"
ON public.fda_projects
FOR DELETE
TO authenticated
USING (true);