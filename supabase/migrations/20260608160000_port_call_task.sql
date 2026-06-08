-- Human-in-the-loop task list per port call (manual + AI-generated).
create table if not exists public.port_call_task (
  id           uuid primary key default gen_random_uuid(),
  port_call_id uuid not null references public.port_call(id) on delete cascade,
  title        text not null,
  done         boolean not null default false,
  source       text not null default 'manual', -- manual | ai
  created_at   timestamptz not null default now()
);
create index if not exists port_call_task_call_idx on public.port_call_task(port_call_id);
alter table public.port_call_task enable row level security;
drop policy if exists port_call_task_all on public.port_call_task;
create policy port_call_task_all on public.port_call_task for all to anon, authenticated using (true) with check (true);
