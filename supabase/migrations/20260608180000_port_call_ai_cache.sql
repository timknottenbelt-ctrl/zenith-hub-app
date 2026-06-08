-- Persist the latest AI scan on the port call so the summary/updates show
-- immediately and we only re-scan when new emails have arrived.
alter table public.port_call
  add column if not exists ai_summary text,
  add column if not exists ai_updates jsonb,
  add column if not exists ai_scanned_at timestamptz,
  add column if not exists ai_scanned_count integer;
