create table if not exists public.chantier_zones (
  id uuid primary key default gen_random_uuid(),
  chantier_id uuid not null references public.chantiers(id) on delete cascade,
  parent_zone_id uuid null references public.chantier_zones(id) on delete set null,
  nom text not null,
  zone_type text not null default 'piece',
  niveau text null,
  emplacement text not null default 'interieur',
  ordre integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chantier_zones_zone_type_chk check (zone_type in ('piece', 'zone', 'niveau', 'etage', 'exterieur')),
  constraint chantier_zones_emplacement_chk check (emplacement in ('interieur', 'exterieur', 'mixte'))
);

create index if not exists chantier_zones_chantier_idx
  on public.chantier_zones (chantier_id, ordre, nom);

create index if not exists chantier_zones_parent_idx
  on public.chantier_zones (parent_zone_id);

alter table public.chantier_zones enable row level security;

drop policy if exists chantier_zones_auth_all on public.chantier_zones;
create policy chantier_zones_auth_all
  on public.chantier_zones
  for all
  to authenticated
  using (true)
  with check (true);

create table if not exists public.chantier_preparation_checklists (
  chantier_id uuid primary key references public.chantiers(id) on delete cascade,
  plans_disponibles boolean not null default false,
  materiaux_commandes boolean not null default false,
  materiel_prevu boolean not null default false,
  intervenants_affectes boolean not null default false,
  acces_chantier_valide boolean not null default false,
  statut text not null default 'chantier_incomplet',
  commentaire text null,
  validated_by uuid null,
  validated_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chantier_preparation_checklists_statut_chk
    check (statut in ('chantier_incomplet', 'chantier_pret'))
);

alter table public.chantier_preparation_checklists enable row level security;

drop policy if exists chantier_preparation_checklists_auth_all on public.chantier_preparation_checklists;
create policy chantier_preparation_checklists_auth_all
  on public.chantier_preparation_checklists
  for all
  to authenticated
  using (true)
  with check (true);

create table if not exists public.chantier_photos (
  id uuid primary key default gen_random_uuid(),
  chantier_id uuid not null references public.chantiers(id) on delete cascade,
  task_id uuid null references public.chantier_tasks(id) on delete set null,
  zone_id uuid null references public.chantier_zones(id) on delete set null,
  photo_type text not null default 'pendant',
  titre text null,
  description text null,
  storage_bucket text not null default 'chantier-documents',
  storage_path text not null,
  taken_on date not null default current_date,
  uploaded_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chantier_photos_photo_type_chk check (photo_type in ('avant', 'pendant', 'apres'))
);

create index if not exists chantier_photos_chantier_idx
  on public.chantier_photos (chantier_id, taken_on desc, created_at desc);

create index if not exists chantier_photos_task_idx
  on public.chantier_photos (task_id, taken_on desc);

create index if not exists chantier_photos_zone_idx
  on public.chantier_photos (zone_id, taken_on desc);

alter table public.chantier_photos enable row level security;

drop policy if exists chantier_photos_auth_all on public.chantier_photos;
create policy chantier_photos_auth_all
  on public.chantier_photos
  for all
  to authenticated
  using (true)
  with check (true);

create table if not exists public.chantier_change_orders (
  id uuid primary key default gen_random_uuid(),
  chantier_id uuid not null references public.chantiers(id) on delete cascade,
  task_id uuid null references public.chantier_tasks(id) on delete set null,
  zone_id uuid null references public.chantier_zones(id) on delete set null,
  type_ecart text not null default 'imprevu_technique',
  titre text not null,
  description text null,
  impact_temps_h numeric not null default 0,
  impact_cout_ht numeric not null default 0,
  statut text not null default 'a_valider',
  requested_by uuid null,
  approved_by uuid null,
  approved_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chantier_change_orders_type_ecart_chk check (
    type_ecart in (
      'travaux_supplementaires',
      'modification_client',
      'imprevu_technique',
      'temps_supplementaire',
      'materiau_non_prevu'
    )
  ),
  constraint chantier_change_orders_statut_chk check (statut in ('a_valider', 'valide', 'refuse', 'integre'))
);

create index if not exists chantier_change_orders_chantier_idx
  on public.chantier_change_orders (chantier_id, created_at desc);

create index if not exists chantier_change_orders_task_idx
  on public.chantier_change_orders (task_id, created_at desc);

create index if not exists chantier_change_orders_zone_idx
  on public.chantier_change_orders (zone_id, created_at desc);

alter table public.chantier_change_orders enable row level security;

drop policy if exists chantier_change_orders_auth_all on public.chantier_change_orders;
create policy chantier_change_orders_auth_all
  on public.chantier_change_orders
  for all
  to authenticated
  using (true)
  with check (true);

create table if not exists public.chantier_purchase_requests (
  id uuid primary key default gen_random_uuid(),
  chantier_id uuid not null references public.chantiers(id) on delete cascade,
  task_id uuid null references public.chantier_tasks(id) on delete set null,
  zone_id uuid null references public.chantier_zones(id) on delete set null,
  supplier_id uuid null,
  supplier_name text null,
  titre text not null,
  quantite numeric null,
  unite text null,
  statut_commande text not null default 'a_commander',
  livraison_prevue_le date null,
  recu boolean not null default false,
  commentaire text null,
  created_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chantier_purchase_requests_statut_commande_chk
    check (statut_commande in ('a_commander', 'commande', 'livre', 'annule'))
);

create index if not exists chantier_purchase_requests_chantier_idx
  on public.chantier_purchase_requests (chantier_id, created_at desc);

create index if not exists chantier_purchase_requests_supplier_idx
  on public.chantier_purchase_requests (supplier_id, created_at desc);

alter table public.chantier_purchase_requests enable row level security;

drop policy if exists chantier_purchase_requests_auth_all on public.chantier_purchase_requests;
create policy chantier_purchase_requests_auth_all
  on public.chantier_purchase_requests
  for all
  to authenticated
  using (true)
  with check (true);

create table if not exists public.chantier_activity_log (
  id uuid primary key default gen_random_uuid(),
  chantier_id uuid not null references public.chantiers(id) on delete cascade,
  actor_id uuid null,
  actor_name text null,
  actor_role text null,
  action_type text not null,
  entity_type text not null,
  entity_id uuid null,
  reason text null,
  changes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists chantier_activity_log_chantier_idx
  on public.chantier_activity_log (chantier_id, created_at desc);

create index if not exists chantier_activity_log_entity_idx
  on public.chantier_activity_log (entity_type, entity_id, created_at desc);

alter table public.chantier_activity_log enable row level security;

drop policy if exists chantier_activity_log_auth_select on public.chantier_activity_log;
create policy chantier_activity_log_auth_select
  on public.chantier_activity_log
  for select
  to authenticated
  using (true);

create or replace function public.chantier_activity_log_insert(
  p_chantier_id uuid,
  p_action_type text,
  p_entity_type text,
  p_entity_id uuid default null,
  p_reason text default null,
  p_changes jsonb default '{}'::jsonb,
  p_actor_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_actor_name text;
begin
  if p_chantier_id is null then
    raise exception 'chantier_id_required';
  end if;

  v_actor_name := nullif(btrim(coalesce(p_actor_name, '')), '');
  if v_actor_name is null then
    v_actor_name := nullif(btrim(coalesce(auth.jwt() ->> 'email', '')), '');
  end if;

  insert into public.chantier_activity_log (
    chantier_id,
    actor_id,
    actor_name,
    actor_role,
    action_type,
    entity_type,
    entity_id,
    reason,
    changes
  ) values (
    p_chantier_id,
    auth.uid(),
    v_actor_name,
    nullif(btrim(coalesce(auth.jwt() ->> 'role', '')), ''),
    coalesce(nullif(btrim(coalesce(p_action_type, '')), ''), 'updated'),
    coalesce(nullif(btrim(coalesce(p_entity_type, '')), ''), 'chantier'),
    p_entity_id,
    nullif(btrim(coalesce(p_reason, '')), ''),
    coalesce(p_changes, '{}'::jsonb)
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.chantier_activity_log_insert(uuid, text, text, uuid, text, jsonb, text) from public;
grant execute on function public.chantier_activity_log_insert(uuid, text, text, uuid, text, jsonb, text) to authenticated;

do $$
begin
  if to_regclass('public.chantier_tasks') is not null then
    alter table public.chantier_tasks
      add column if not exists zone_id uuid null references public.chantier_zones(id) on delete set null,
      add column if not exists etape_metier text null,
      add column if not exists quality_status text not null default 'a_faire',
      add column if not exists admin_validation_status text not null default 'non_verifie',
      add column if not exists validated_by uuid null,
      add column if not exists validated_at timestamptz null,
      add column if not exists reprise_reason text null,
      add column if not exists cout_mo_prevu_ht numeric null,
      add column if not exists cout_mo_reel_ht numeric null;

    update public.chantier_tasks
    set
      quality_status = coalesce(nullif(btrim(quality_status), ''), 'a_faire'),
      admin_validation_status = coalesce(nullif(btrim(admin_validation_status), ''), 'non_verifie');

    if not exists (
      select 1
      from pg_constraint
      where conrelid = 'public.chantier_tasks'::regclass
        and conname = 'chantier_tasks_quality_status_chk'
    ) then
      alter table public.chantier_tasks
        add constraint chantier_tasks_quality_status_chk
        check (quality_status in ('a_faire', 'en_cours', 'termine_intervenant', 'valide_admin', 'a_reprendre'));
    end if;

    if not exists (
      select 1
      from pg_constraint
      where conrelid = 'public.chantier_tasks'::regclass
        and conname = 'chantier_tasks_admin_validation_status_chk'
    ) then
      alter table public.chantier_tasks
        add constraint chantier_tasks_admin_validation_status_chk
        check (admin_validation_status in ('non_verifie', 'valide', 'a_reprendre'));
    end if;

    create index if not exists chantier_tasks_zone_idx
      on public.chantier_tasks (zone_id, order_index);
  end if;
end $$;

do $$
begin
  if to_regclass('public.chantier_documents') is not null then
    alter table public.chantier_documents
      add column if not exists zone_id uuid null references public.chantier_zones(id) on delete set null,
      add column if not exists document_kind text null;

    create index if not exists chantier_documents_zone_idx
      on public.chantier_documents (zone_id, created_at desc);
  end if;
end $$;

do $$
begin
  if to_regclass('public.chantier_reserves') is not null then
    alter table public.chantier_reserves
      add column if not exists zone_id uuid null references public.chantier_zones(id) on delete set null;

    create index if not exists chantier_reserves_zone_idx
      on public.chantier_reserves (zone_id, created_at desc);
  end if;
end $$;

do $$
begin
  if to_regclass('public.chantier_consignes') is not null then
    alter table public.chantier_consignes
      add column if not exists zone_id uuid null references public.chantier_zones(id) on delete set null;

    create index if not exists chantier_consignes_zone_idx
      on public.chantier_consignes (zone_id, date_debut desc);
  end if;
end $$;

do $$
begin
  if to_regclass('public.terrain_feedbacks') is not null then
    alter table public.terrain_feedbacks
      add column if not exists zone_id uuid null references public.chantier_zones(id) on delete set null;

    create index if not exists terrain_feedbacks_zone_idx
      on public.terrain_feedbacks (zone_id, created_at desc);
  end if;
end $$;
