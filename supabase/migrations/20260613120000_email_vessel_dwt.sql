-- DWT was extracted from inbound inquiries but had nowhere to land on the
-- `email` row (the table had vessel_loa / vessel_grt / vessel_flag but no
-- vessel_dwt), so it was silently dropped. Add the missing columns so DWT can
-- be stored alongside the other vessel particulars.
ALTER TABLE public.email ADD COLUMN IF NOT EXISTS vessel_dwt numeric;
ALTER TABLE public.email ADD COLUMN IF NOT EXISTS vessel_2_dwt numeric;
