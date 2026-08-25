-- Profils et accès : rattachement en direct (lien vivant) d'un compte à un
-- profil type, et fermeture du bug organization_id = auth.uid() sur
-- profile_permission_presets (la table existait déjà en prod hors migration,
-- avec chaque admin ayant sa propre copie des profils types au lieu d'une
-- copie partagée par l'entreprise, et une FK organization_id -> auth.users
-- au lieu de organizations).
--
-- Scope : uniquement profiles.permission_preset_id et
-- profile_permission_presets. N'a aucun effet sur les policies des autres
-- tables (Lot 2 RLS closure, toujours en brouillon, non touché ici).

-- --- 1. Lien vivant profil type -> compte -----------------------------------
alter table public.profiles
  add column if not exists permission_preset_id text;

comment on column public.profiles.permission_preset_id is
  'Profil type (business preset, ex: commercial, comptable) auquel ce compte est rattaché en direct. Quand renseigné, profiles.feature_permissions ne contient que les exceptions (overrides) par rapport au profil type ; le reste des droits suit le profil type en temps réel — le modifier met à jour tous les comptes qui y sont rattachés.';

-- --- 2. Table des profils types, avec le vrai organization_id ---------------
create table if not exists public.profile_permission_presets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  preset_id text not null,
  permissions jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

comment on table public.profile_permission_presets is
  'Personnalisation par entreprise des droits par défaut de chaque profil type (business preset). organization_id référence la vraie organisation, pas auth.uid().';

-- La table a pu être créée hors migration avec organization_id référençant
-- auth.users (ancien pattern organization_id = auth.uid()) : on retire cette
-- FK avant de toucher aux données, pour pouvoir remapper les valeurs sans
-- qu'elle ne bloque l'UPDATE ci-dessous.
do $$
declare
  v_fk_def text;
begin
  select pg_get_constraintdef(oid) into v_fk_def
  from pg_constraint
  where conrelid = 'public.profile_permission_presets'::regclass
    and contype = 'f';

  if v_fk_def is not null and v_fk_def not ilike '%references public.organizations%' and v_fk_def not ilike '%references organizations%' then
    alter table public.profile_permission_presets
      drop constraint profile_permission_presets_organization_id_fkey;
  end if;
end $$;

-- Toute ligne dont organization_id est en réalité un ancien auth.uid()
-- (admin créateur) est rattachée à l'organisation réelle de ce compte, puis
-- les doublons (organization_id, preset_id) résultants sont fusionnés en ne
-- gardant que la ligne la plus récente, et les lignes orphelines restantes
-- (organization_id qui ne correspond à aucun profil ni organisation connue)
-- sont supprimées plutôt que de laisser la contrainte FK échouer plus bas.
do $$
begin
  if to_regclass('public.profile_permission_presets') is not null then
    update public.profile_permission_presets ppp
    set organization_id = p.organization_id
    from public.profiles p
    where p.id = ppp.organization_id
      and p.organization_id is not null
      and p.organization_id <> ppp.organization_id;

    delete from public.profile_permission_presets ppp
    using public.profile_permission_presets newer
    where ppp.organization_id = newer.organization_id
      and ppp.preset_id = newer.preset_id
      and ppp.updated_at < newer.updated_at;

    delete from public.profile_permission_presets ppp
    using public.profile_permission_presets newer
    where ppp.organization_id = newer.organization_id
      and ppp.preset_id = newer.preset_id
      and ppp.updated_at = newer.updated_at
      and ppp.id < newer.id;

    delete from public.profile_permission_presets ppp
    where not exists (
      select 1 from public.organizations o where o.id = ppp.organization_id
    );
  end if;
end $$;

-- Données propres : on peut maintenant poser la bonne FK et l'unicité.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profile_permission_presets'::regclass
      and contype = 'f'
  ) then
    alter table public.profile_permission_presets
      add constraint profile_permission_presets_organization_id_fkey
      foreign key (organization_id) references public.organizations(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profile_permission_presets'::regclass
      and contype = 'u'
  ) then
    alter table public.profile_permission_presets
      add constraint profile_permission_presets_organization_id_preset_id_key
      unique (organization_id, preset_id);
  end if;
end $$;

alter table public.profile_permission_presets enable row level security;

-- Lecture : tout membre authentifié de l'organisation (nécessaire pour que
-- chaque compte, pas seulement les ADMIN, calcule ses propres droits effectifs
-- quand il est rattaché à un profil type).
drop policy if exists profile_permission_presets_org_select on public.profile_permission_presets;
create policy profile_permission_presets_org_select
  on public.profile_permission_presets
  for select
  to authenticated
  using (
    organization_id in (select p.organization_id from public.profiles p where p.id = auth.uid())
  );

-- Écriture : seuls les ADMIN de l'organisation.
drop policy if exists profile_permission_presets_admin_write on public.profile_permission_presets;
create policy profile_permission_presets_admin_write
  on public.profile_permission_presets
  for all
  to authenticated
  using (
    public.is_admin()
    and organization_id in (select p.organization_id from public.profiles p where p.id = auth.uid())
  )
  with check (
    public.is_admin()
    and organization_id in (select p.organization_id from public.profiles p where p.id = auth.uid())
  );
