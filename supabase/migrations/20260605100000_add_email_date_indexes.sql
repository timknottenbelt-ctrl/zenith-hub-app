-- Speed up the date filters on the inquiry/manual-email lists.
create index if not exists idx_manual_emails_created_at on public.manual_emails (created_at desc);
create index if not exists idx_email_created_at on public.email (created_at desc);
