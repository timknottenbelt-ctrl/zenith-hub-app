-- Link a Curaçao FDA project to a port-call dossier so the FDA Creator can be
-- opened with context from a port call and shown back on the dossier.
alter table public.fda_curacao_projects add column if not exists dossier_key text;
create index if not exists fda_curacao_projects_dossier_key_idx on public.fda_curacao_projects (dossier_key);
