-- Port Call operations: persistent dossier + Statement-of-Facts event log +
-- nomination/revenue tracking + arrival-document checklist.
--
-- Port-call dossiers are derived client-side from the `email` table, keyed by a
-- stable `dossier_key` (vessel slug + first-seen date). These tables let the
-- operations side of a call (events, nomination, documents) persist against
-- that key.

create table if not exists public.port_call (
  id                  uuid primary key default gen_random_uuid(),
  dossier_key         text unique not null,
  slug                text not null,
  vessel_name         text,
  imo                 text,
  -- high-level lifecycle: expected | nominated | alongside | sailed | closed
  status              text not null default 'expected',
  nominated           boolean not null default false,
  nomination_amount   numeric,
  nomination_currency text default 'USD',
  principal           text,
  eta                 timestamptz,
  etb                 timestamptz,
  etd                 timestamptz,
  terminal            text,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table if not exists public.port_call_event (
  id            uuid primary key default gen_random_uuid(),
  port_call_id  uuid not null references public.port_call(id) on delete cascade,
  event_type    text not null,
  event_time    timestamptz not null default now(),
  remark        text,
  created_at    timestamptz not null default now()
);
create index if not exists port_call_event_call_idx
  on public.port_call_event(port_call_id, event_time);

create table if not exists public.port_call_doc (
  id            uuid primary key default gen_random_uuid(),
  port_call_id  uuid not null references public.port_call(id) on delete cascade,
  label         text not null,
  url           text,
  doc_kind      text default 'arrival',   -- arrival | other
  status        text default 'pending',   -- pending | sent | received
  created_at    timestamptz not null default now()
);
create index if not exists port_call_doc_call_idx
  on public.port_call_doc(port_call_id);

-- Keep updated_at fresh on the dossier row.
create or replace function public.touch_port_call_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists port_call_touch on public.port_call;
create trigger port_call_touch before update on public.port_call
  for each row execute function public.touch_port_call_updated_at();

-- Internal dashboard: permissive RLS for the app's roles (matches the rest of
-- the project, which uses public bucket/table access for the anon/auth keys).
alter table public.port_call        enable row level security;
alter table public.port_call_event  enable row level security;
alter table public.port_call_doc    enable row level security;

drop policy if exists port_call_all on public.port_call;
create policy port_call_all on public.port_call
  for all to anon, authenticated using (true) with check (true);

drop policy if exists port_call_event_all on public.port_call_event;
create policy port_call_event_all on public.port_call_event
  for all to anon, authenticated using (true) with check (true);

drop policy if exists port_call_doc_all on public.port_call_doc;
create policy port_call_doc_all on public.port_call_doc
  for all to anon, authenticated using (true) with check (true);
