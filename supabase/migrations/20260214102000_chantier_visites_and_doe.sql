create table if not exists public.chantier_visites (
  id uuid primary key default gen_random_uuid(),
  chantier_id uuid not null references public.chantiers(id) on delete cascade,
  visit_datetime timestamptz not null,
  redactor_email text null,
  participants text[] not null default '{}',
  meteo text null,
  avancement_text text null,
  avancement_percent numeric(5,2) null,
  observations text null,
  safety_points text null,
  decisions text null,
  include_in_doe boolean not null default false,
  photo_count int not null default 0,
  pdf_document_id uuid null references public.chantier_documents(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists chantier_visites_chantier_idx
  on public.chantier_visites(chantier_id, visit_datetime desc);

create table if not exists public.chantier_visite_actions (
  id uuid primary key default gen_random_uuid(),
  visite_id uuid not null references public.chantier_visites(id) on delete cascade,
  action_text text not null,
  responsable text null,
  due_date date null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists chantier_visite_actions_visite_idx
  on public.chantier_visite_actions(visite_id, sort_order, created_at);

create table if not exists public.chantier_doe_items (
  id uuid primary key default gen_random_uuid(),
  chantier_id uuid not null references public.chantiers(id) on delete cascade,
  document_id uuid not null references public.chantier_documents(id) on delete cascade,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (chantier_id, document_id)
);

create index if not exists chantier_doe_items_chantier_idx
  on public.chantier_doe_items(chantier_id, sort_order, created_at);

alter table public.chantier_visites enable row level security;
alter table public.chantier_visite_actions enable row level security;
alter table public.chantier_doe_items enable row level security;

drop policy if exists "chantier_visites_admin_all" on public.chantier_visites;
drop policy if exists "chantier_visites_intervenant_select" on public.chantier_visites;
drop policy if exists "chantier_visite_actions_admin_all" on public.chantier_visite_actions;
drop policy if exists "chantier_visite_actions_intervenant_select" on public.chantier_visite_actions;
drop policy if exists "chantier_doe_items_admin_all" on public.chantier_doe_items;
drop policy if exists "chantier_doe_items_intervenant_select" on public.chantier_doe_items;

create policy "chantier_visites_admin_all"
  on public.chantier_visites
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "chantier_visites_intervenant_select"
  on public.chantier_visites
  for select
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1
      from public.chantier_intervenant_access cia
      where cia.chantier_id = chantier_visites.chantier_id
        and lower(cia.intervenant_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );

create policy "chantier_visite_actions_admin_all"
  on public.chantier_visite_actions
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "chantier_visite_actions_intervenant_select"
  on public.chantier_visite_actions
  for select
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1
      from public.chantier_visites v
      join public.chantier_intervenant_access cia on cia.chantier_id = v.chantier_id
      where v.id = chantier_visite_actions.visite_id
        and lower(cia.intervenant_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );

create policy "chantier_doe_items_admin_all"
  on public.chantier_doe_items
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "chantier_doe_items_intervenant_select"
  on public.chantier_doe_items
  for select
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1
      from public.chantier_intervenant_access cia
      where cia.chantier_id = chantier_doe_items.chantier_id
        and lower(cia.intervenant_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );
