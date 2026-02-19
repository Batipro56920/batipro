alter table public.chantier_visites
  add column if not exists numero int null,
  add column if not exists titre text not null default 'Visite de chantier',
  add column if not exists phase text null,
  add column if not exists objectif text null,
  add column if not exists resume text null,
  add column if not exists points_positifs text null,
  add column if not exists points_bloquants text null,
  add column if not exists updated_at timestamptz not null default now();

update public.chantier_visites
set
  titre = coalesce(nullif(trim(titre), ''), 'Visite de chantier'),
  updated_at = coalesce(updated_at, now())
where
  titre is null
  or trim(titre) = ''
  or updated_at is null;

create unique index if not exists chantier_visites_chantier_numero_uq
  on public.chantier_visites(chantier_id, numero)
  where numero is not null;

create index if not exists chantier_visites_chantier_created_idx
  on public.chantier_visites(chantier_id, created_at desc);

alter table public.chantier_visite_actions
  add column if not exists description text null,
  add column if not exists responsable_type text null,
  add column if not exists responsable_nom text null,
  add column if not exists intervenant_id uuid null references public.intervenants(id) on delete set null,
  add column if not exists echeance date null,
  add column if not exists statut text not null default 'A_FAIRE',
  add column if not exists commentaire text null,
  add column if not exists ordre int not null default 0;

alter table public.chantier_visite_actions
  drop constraint if exists chantier_visite_actions_responsable_type_check;

alter table public.chantier_visite_actions
  add constraint chantier_visite_actions_responsable_type_check
  check (responsable_type in ('CLIENT', 'INTERVENANT', 'CB_RENOVATION', 'AUTRE'));

alter table public.chantier_visite_actions
  drop constraint if exists chantier_visite_actions_statut_check;

alter table public.chantier_visite_actions
  add constraint chantier_visite_actions_statut_check
  check (statut in ('A_FAIRE', 'EN_COURS', 'FAIT'));

update public.chantier_visite_actions
set
  description = coalesce(description, action_text),
  action_text = coalesce(action_text, description),
  responsable_nom = coalesce(responsable_nom, responsable),
  responsable = coalesce(responsable, responsable_nom),
  echeance = coalesce(echeance, due_date),
  due_date = coalesce(due_date, echeance),
  ordre = coalesce(nullif(ordre, 0), sort_order, 0),
  sort_order = coalesce(nullif(sort_order, 0), ordre, 0),
  responsable_type = coalesce(responsable_type, 'AUTRE'),
  statut = coalesce(statut, 'A_FAIRE')
where
  description is null
  or action_text is null
  or responsable_nom is null
  or responsable is null
  or echeance is null
  or due_date is null
  or responsable_type is null
  or statut is null;

create index if not exists chantier_visite_actions_visite_ordre_idx
  on public.chantier_visite_actions(visite_id, ordre, created_at);

create table if not exists public.chantier_visite_participants (
  id uuid primary key default gen_random_uuid(),
  visite_id uuid not null references public.chantier_visites(id) on delete cascade,
  type text not null check (type in ('CLIENT', 'INTERVENANT', 'MOA', 'MOE', 'AUTRE')),
  nom text not null,
  intervenant_id uuid null references public.intervenants(id) on delete set null,
  email text null,
  present boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists chantier_visite_participants_visite_idx
  on public.chantier_visite_participants(visite_id);

create table if not exists public.chantier_visite_snapshot (
  id uuid primary key default gen_random_uuid(),
  visite_id uuid not null unique references public.chantier_visites(id) on delete cascade,
  data jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.chantier_visite_documents (
  id uuid primary key default gen_random_uuid(),
  visite_id uuid not null references public.chantier_visites(id) on delete cascade,
  document_id uuid not null references public.chantier_documents(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (visite_id, document_id)
);

create index if not exists chantier_visite_documents_visite_idx
  on public.chantier_visite_documents(visite_id);

alter table public.chantier_visite_participants enable row level security;
alter table public.chantier_visite_snapshot enable row level security;
alter table public.chantier_visite_documents enable row level security;

drop policy if exists "chantier_visite_participants_admin_all" on public.chantier_visite_participants;
drop policy if exists "chantier_visite_participants_intervenant_select" on public.chantier_visite_participants;
drop policy if exists "chantier_visite_snapshot_admin_all" on public.chantier_visite_snapshot;
drop policy if exists "chantier_visite_snapshot_intervenant_select" on public.chantier_visite_snapshot;
drop policy if exists "chantier_visite_documents_admin_all" on public.chantier_visite_documents;
drop policy if exists "chantier_visite_documents_intervenant_select" on public.chantier_visite_documents;

create policy "chantier_visite_participants_admin_all"
  on public.chantier_visite_participants
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "chantier_visite_participants_intervenant_select"
  on public.chantier_visite_participants
  for select
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1
      from public.chantier_visites v
      join public.chantier_access ca on ca.chantier_id = v.chantier_id
      where v.id = chantier_visite_participants.visite_id
        and lower(ca.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );

create policy "chantier_visite_snapshot_admin_all"
  on public.chantier_visite_snapshot
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "chantier_visite_snapshot_intervenant_select"
  on public.chantier_visite_snapshot
  for select
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1
      from public.chantier_visites v
      join public.chantier_access ca on ca.chantier_id = v.chantier_id
      where v.id = chantier_visite_snapshot.visite_id
        and lower(ca.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );

create policy "chantier_visite_documents_admin_all"
  on public.chantier_visite_documents
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "chantier_visite_documents_intervenant_select"
  on public.chantier_visite_documents
  for select
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1
      from public.chantier_visites v
      join public.chantier_access ca on ca.chantier_id = v.chantier_id
      where v.id = chantier_visite_documents.visite_id
        and lower(ca.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );
