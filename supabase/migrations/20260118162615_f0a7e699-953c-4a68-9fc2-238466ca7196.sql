-- Add invoice_number column to fda_invoices table
ALTER TABLE public.fda_invoices 
ADD COLUMN invoice_number text;