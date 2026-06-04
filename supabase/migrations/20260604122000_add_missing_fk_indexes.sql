-- Add covering indexes for foreign keys flagged by the performance advisor.
-- Speeds up joins and cascade lookups on these relations.

CREATE INDEX IF NOT EXISTS idx_email_attachments_email_id
  ON public.email_attachments (email_id);

CREATE INDEX IF NOT EXISTS idx_fda_creator_invoices_project_id
  ON public.fda_creator_invoices (project_id);

CREATE INDEX IF NOT EXISTS idx_fda_curacao_processed_invoices_project_id
  ON public.fda_curacao_processed_invoices (project_id);

CREATE INDEX IF NOT EXISTS idx_pda_outputs_vessel_input_id
  ON public.pda_outputs (vessel_input_id);
