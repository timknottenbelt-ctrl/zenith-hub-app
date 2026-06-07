-- Add an "archived" flag so emails can be removed from the dashboard views
-- without deleting any data. Used to:
--   1. clear the Out-of-Scope list (all status='out_of_scope' rows)
--   2. remove non-inquiry thread noise (forwards / status / docs / duplicates)
--      from the AI Inquiries triage queue
-- Reversible: set archived=false to restore a row to its normal view.

ALTER TABLE public.email
  ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;

-- Partial index: dashboard queries always filter archived=false, so index the
-- active rows by created_at for fast ordered scans.
CREATE INDEX IF NOT EXISTS email_active_created_idx
  ON public.email (created_at DESC)
  WHERE archived = false;
