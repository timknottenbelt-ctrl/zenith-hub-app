-- Stored DA (Disbursement Account) calculations: the computed cost lines, any
-- user-added extra lines (NGO fee, bank charges...), the total, and the PDF url.
create table if not exists public.da_outputs (
  id bigserial primary key,
  source text,                 -- 'manual_email' | 'email' | 'manual'
  source_id bigint,
  doc_type text default 'PDA', -- PDA | EDA | FDA
  vessel_name text, gt numeric, loa numeric, dwt numeric,
  port_stay numeric, tugs integer, linesmen_hours numeric,
  facility text, area text, terminal text,
  operation_type text, cargo_type text, cargo_quantity numeric,
  client_name text, client_email text,
  lines jsonb default '[]'::jsonb,        -- computed DA lines
  extra_lines jsonb default '[]'::jsonb,  -- user-added lines
  total numeric,
  pdf_url text,
  status text default 'draft',
  created_at timestamptz default now()
);
alter table public.da_outputs enable row level security;
create policy "authenticated_read"  on public.da_outputs for select to authenticated using (true);
create policy "authenticated_write" on public.da_outputs for all to authenticated using (true) with check (true);
create policy "service_role_all"    on public.da_outputs for all to service_role using (true) with check (true);
