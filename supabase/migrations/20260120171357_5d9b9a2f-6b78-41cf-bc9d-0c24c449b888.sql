-- Add advanced payment fields to fda_projects table
ALTER TABLE public.fda_projects 
ADD COLUMN IF NOT EXISTS advanced_payment_amount numeric,
ADD COLUMN IF NOT EXISTS advanced_payment_currency text DEFAULT 'USD',
ADD COLUMN IF NOT EXISTS advanced_payment_reference text,
ADD COLUMN IF NOT EXISTS advanced_payment_status text DEFAULT 'unpaid',
ADD COLUMN IF NOT EXISTS advanced_payment_remark text;