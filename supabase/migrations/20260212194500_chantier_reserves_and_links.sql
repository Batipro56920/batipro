-- Reserves table (create if missing)
create table if not exists public.chantier_reserves (
  id uuid primary key default gen_random_uuid(),
  chantier_id uuid not null references public.chantiers(id) on delete cascade,
  title text not null,
  description text null,
  status text not null default 'OUVERTE',
  priority text not null default 'NORMALE',
  intervenant_id uuid null,
  levee_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists chantier_reserves_chantier_idx
  on public.chantier_reserves(chantier_id);

create index if not exists chantier_reserves_status_idx
  on public.chantier_reserves(status);

-- Reserve documents (photos / pieces jointes)
create table if not exists public.reserve_documents (
  id uuid primary key default gen_random_uuid(),
  reserve_id uuid not null references public.chantier_reserves(id) on delete cascade,
  document_id uuid not null references public.chantier_documents(id) on delete cascade,
  role text not null default 'PHOTO',
  created_at timestamptz not null default now()
);

create index if not exists reserve_documents_reserve_idx
  on public.reserve_documents(reserve_id);

create index if not exists reserve_documents_document_idx
  on public.reserve_documents(document_id);

alter table public.reserve_documents enable row level security;

create policy "auth select reserve_documents"
  on public.reserve_documents
  for select
  to authenticated
  using (true);

create policy "auth insert reserve_documents"
  on public.reserve_documents
  for insert
  to authenticated
  with check (true);

create policy "auth update reserve_documents"
  on public.reserve_documents
  for update
  to authenticated
  using (true)
  with check (true);

create policy "auth delete reserve_documents"
  on public.reserve_documents
  for delete
  to authenticated
  using (true);

-- Reserve plan markers
create table if not exists public.reserve_plan_markers (
  id uuid primary key default gen_random_uuid(),
  reserve_id uuid not null references public.chantier_reserves(id) on delete cascade,
  plan_document_id uuid not null references public.chantier_documents(id) on delete cascade,
  page int null,
  x double precision not null,
  y double precision not null,
  label text null,
  created_at timestamptz not null default now()
);

create index if not exists reserve_plan_markers_reserve_idx
  on public.reserve_plan_markers(reserve_id);

create index if not exists reserve_plan_markers_plan_idx
  on public.reserve_plan_markers(plan_document_id);

alter table public.reserve_plan_markers enable row level security;

create policy "auth select reserve_plan_markers"
  on public.reserve_plan_markers
  for select
  to authenticated
  using (true);

create policy "auth insert reserve_plan_markers"
  on public.reserve_plan_markers
  for insert
  to authenticated
  with check (true);

create policy "auth update reserve_plan_markers"
  on public.reserve_plan_markers
  for update
  to authenticated
  using (true)
  with check (true);

create policy "auth delete reserve_plan_markers"
  on public.reserve_plan_markers
  for delete
  to authenticated
  using (true);
