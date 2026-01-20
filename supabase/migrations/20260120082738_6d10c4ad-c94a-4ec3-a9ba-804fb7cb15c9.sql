-- Add DELETE policy for email table to allow authenticated users to delete emails
CREATE POLICY "Authenticated users can delete emails" 
ON public.email 
FOR DELETE 
USING (auth.role() = 'authenticated');