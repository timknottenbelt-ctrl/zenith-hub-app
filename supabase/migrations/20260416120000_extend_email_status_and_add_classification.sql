-- Extend email_status enum with lifecycle states for the new v3 workflow
-- Existing values: draft, sent, rejected, approved
-- New values:
--   inbound        — freshly received, not yet classified
--   processing     — classified, downstream PDA generation running
--   out_of_scope   — deterministic pre-filter or LLM said this is not a new request
--   needs_review   — LLM classified with confidence below threshold

ALTER TYPE public.email_status ADD VALUE IF NOT EXISTS 'inbound';
ALTER TYPE public.email_status ADD VALUE IF NOT EXISTS 'processing';
ALTER TYPE public.email_status ADD VALUE IF NOT EXISTS 'out_of_scope';
ALTER TYPE public.email_status ADD VALUE IF NOT EXISTS 'needs_review';

-- Add classification metadata columns on the email table so the dashboard can
-- show why something was filtered or which confidence it got.
ALTER TABLE public.email
  ADD COLUMN IF NOT EXISTS classification_confidence numeric(3,2),
  ADD COLUMN IF NOT EXISTS classification_reasoning text,
  ADD COLUMN IF NOT EXISTS received_at timestamptz;

COMMENT ON COLUMN public.email.classification_confidence IS 'LLM confidence score 0.00-1.00. NULL for deterministic pre-filter outcomes.';
COMMENT ON COLUMN public.email.classification_reasoning IS 'Short human-readable reason for the current classification / status.';
COMMENT ON COLUMN public.email.received_at IS 'When the email was received in Outlook (distinct from created_at which is the DB insert time).';
