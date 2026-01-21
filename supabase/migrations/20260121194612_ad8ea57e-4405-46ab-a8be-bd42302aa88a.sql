-- Create a separate table for FDA Curacao projects
CREATE TABLE public.fda_curacao_projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id TEXT NOT NULL UNIQUE,
  lbh_number TEXT NOT NULL,
  ship_name TEXT NOT NULL,
  client_name TEXT,
  client_email TEXT,
  client_phone TEXT,
  client_reference TEXT,
  billing_company TEXT,
  billing_email TEXT,
  billing_phone TEXT,
  billing_address TEXT,
  fda_responsible TEXT,
  operation TEXT,
  commodity TEXT,
  vessel_arrived TEXT,
  vessel_sailed TEXT,
  google_sheet_url TEXT,
  google_sheet_id TEXT,
  front_page_url TEXT,
  agency_cost_url TEXT,
  final_pdf_url TEXT,
  total_amount NUMERIC,
  total_invoices INTEGER,
  advanced_payment_status TEXT,
  advanced_payment_amount NUMERIC,
  advanced_payment_currency TEXT,
  advanced_payment_reference TEXT,
  advanced_payment_remark TEXT,
  email_subject TEXT,
  email_body TEXT,
  email_sent_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'draft',
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.fda_curacao_projects ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Users can view all FDA Curacao projects"
ON public.fda_curacao_projects
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can create FDA Curacao projects"
ON public.fda_curacao_projects
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Users can update FDA Curacao projects"
ON public.fda_curacao_projects
FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Users can delete FDA Curacao projects"
ON public.fda_curacao_projects
FOR DELETE
TO authenticated
USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_fda_curacao_projects_updated_at
BEFORE UPDATE ON public.fda_curacao_projects
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create a separate table for FDA Curacao processed invoices
CREATE TABLE public.fda_curacao_processed_invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES public.fda_curacao_projects(project_id) ON DELETE CASCADE,
  lbh_number TEXT NOT NULL,
  ship_name TEXT NOT NULL,
  invoice_number TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT,
  supplier_name TEXT,
  description TEXT,
  total_amount NUMERIC,
  currency TEXT,
  invoice_date TEXT,
  due_date TEXT,
  remark TEXT,
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.fda_curacao_processed_invoices ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Users can view all FDA Curacao invoices"
ON public.fda_curacao_processed_invoices
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can create FDA Curacao invoices"
ON public.fda_curacao_processed_invoices
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Users can update FDA Curacao invoices"
ON public.fda_curacao_processed_invoices
FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Users can delete FDA Curacao invoices"
ON public.fda_curacao_processed_invoices
FOR DELETE
TO authenticated
USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_fda_curacao_processed_invoices_updated_at
BEFORE UPDATE ON public.fda_curacao_processed_invoices
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();