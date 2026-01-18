-- Add RLS policies for manual_emails table
CREATE POLICY "Public can insert manual_emails" 
ON public.manual_emails 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Public can read manual_emails" 
ON public.manual_emails 
FOR SELECT 
USING (true);

CREATE POLICY "Public can update manual_emails" 
ON public.manual_emails 
FOR UPDATE 
USING (true);

CREATE POLICY "Public can delete manual_emails" 
ON public.manual_emails 
FOR DELETE 
USING (true);