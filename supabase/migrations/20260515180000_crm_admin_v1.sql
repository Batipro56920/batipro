create extension if not exists pgcrypto;

alter table if exists public.profiles
  drop constraint if exists profiles_role_check;

alter table if exists public.profiles
  add constraint profiles_role_check
  check (role = any (array['ADMIN'::text, 'COMMERCIAL'::text, 'CONDUCTEUR'::text, 'ASSISTANT'::text, 'INTERVENANT'::text]));

create table if not exists public.crm_sources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default auth.uid(),
  label text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_tags (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default auth.uid(),
  label text not null,
  color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default auth.uid(),
  key text not null,
  label text not null,
  ordre int not null default 0,
  probability_default int not null default 0,
  is_won boolean not null default false,
  is_lost boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, key)
);

create table if not exists public.crm_clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default auth.uid(),
  type text not null default 'particulier',
  civilite text,
  prenom text,
  nom text,
  societe text,
  email text,
  telephone text,
  mobile text,
  adresse text,
  code_postal text,
  ville text,
  billing_address jsonb not null default '{}'::jsonb,
  addresses jsonb not null default '[]'::jsonb,
  tags text[] not null default '{}'::text[],
  notes text,
  owner_id uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table if not exists public.crm_prospects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default auth.uid(),
  type text not null default 'particulier',
  civilite text,
  prenom text,
  nom text,
  societe text,
  telephone text,
  mobile text,
  email text,
  adresse text,
  code_postal text,
  ville text,
  source_acquisition text,
  apporteur_affaire text,
  tags text[] not null default '{}'::text[],
  notes text,
  budget_estime numeric,
  urgence text,
  type_projet text,
  description_besoin text,
  owner_id uuid default auth.uid(),
  statut text not null default 'nouveau',
  client_id uuid references public.crm_clients(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table if not exists public.crm_opportunities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default auth.uid(),
  prospect_id uuid references public.crm_prospects(id) on delete set null,
  client_id uuid references public.crm_clients(id) on delete set null,
  stage_id uuid references public.crm_pipeline_stages(id) on delete set null,
  stage_key text not null default 'lead',
  nom_affaire text not null,
  montant_estime numeric not null default 0,
  probabilite int not null default 0,
  echeance date,
  responsable_id uuid default auth.uid(),
  prochaine_action text,
  prochaine_action_date date,
  notes text,
  tags text[] not null default '{}'::text[],
  status text not null default 'ouverte',
  lost_reason text,
  chantier_id uuid references public.chantiers(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table if not exists public.crm_quotes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default auth.uid(),
  quote_number text not null,
  prospect_id uuid references public.crm_prospects(id) on delete set null,
  client_id uuid references public.crm_clients(id) on delete set null,
  opportunity_id uuid references public.crm_opportunities(id) on delete set null,
  statut text not null default 'brouillon',
  date_emission date,
  valid_until date,
  montant_ht numeric not null default 0,
  tva numeric not null default 20,
  montant_ttc numeric not null default 0,
  marge_estimee numeric,
  lot text,
  description text,
  signature_status text not null default 'attente_signature',
  accepted_at timestamptz,
  refused_at timestamptz,
  chantier_id uuid references public.chantiers(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, quote_number)
);

create table if not exists public.crm_quote_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default auth.uid(),
  quote_id uuid not null references public.crm_quotes(id) on delete cascade,
  lot text,
  designation text not null,
  description text,
  quantite numeric not null default 1,
  unite text,
  prix_unitaire_ht numeric not null default 0,
  total_ht numeric not null default 0,
  ordre int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default auth.uid(),
  prospect_id uuid references public.crm_prospects(id) on delete cascade,
  client_id uuid references public.crm_clients(id) on delete cascade,
  opportunity_id uuid references public.crm_opportunities(id) on delete cascade,
  quote_id uuid references public.crm_quotes(id) on delete cascade,
  type text not null default 'relance',
  titre text not null,
  description text,
  due_at timestamptz,
  priorite text not null default 'normale',
  statut text not null default 'a_faire',
  assigned_to uuid default auth.uid(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_appointments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default auth.uid(),
  prospect_id uuid references public.crm_prospects(id) on delete cascade,
  client_id uuid references public.crm_clients(id) on delete cascade,
  opportunity_id uuid references public.crm_opportunities(id) on delete cascade,
  type text not null default 'rdv_commercial',
  titre text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  rappel_at timestamptz,
  statut text not null default 'planifie',
  notes text,
  compte_rendu text,
  assigned_to uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default auth.uid(),
  prospect_id uuid references public.crm_prospects(id) on delete cascade,
  client_id uuid references public.crm_clients(id) on delete cascade,
  opportunity_id uuid references public.crm_opportunities(id) on delete cascade,
  quote_id uuid references public.crm_quotes(id) on delete cascade,
  chantier_id uuid references public.chantiers(id) on delete set null,
  type text not null default 'autre',
  nom text not null,
  url text,
  storage_path text,
  mime_type text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default auth.uid(),
  prospect_id uuid references public.crm_prospects(id) on delete cascade,
  client_id uuid references public.crm_clients(id) on delete cascade,
  opportunity_id uuid references public.crm_opportunities(id) on delete cascade,
  quote_id uuid references public.crm_quotes(id) on delete cascade,
  chantier_id uuid references public.chantiers(id) on delete set null,
  note text not null,
  is_internal boolean not null default true,
  author_id uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.crm_communications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default auth.uid(),
  prospect_id uuid references public.crm_prospects(id) on delete cascade,
  client_id uuid references public.crm_clients(id) on delete cascade,
  opportunity_id uuid references public.crm_opportunities(id) on delete cascade,
  quote_id uuid references public.crm_quotes(id) on delete cascade,
  type text not null default 'note',
  direction text not null default 'sortant',
  subject text,
  body text,
  occurred_at timestamptz not null default now(),
  author_id uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.crm_invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default auth.uid(),
  client_id uuid references public.crm_clients(id) on delete set null,
  quote_id uuid references public.crm_quotes(id) on delete set null,
  chantier_id uuid references public.chantiers(id) on delete set null,
  type text not null default 'acompte',
  invoice_number text,
  amount_ht numeric not null default 0,
  amount_ttc numeric not null default 0,
  due_date date,
  statut text not null default 'brouillon',
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_sav (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default auth.uid(),
  client_id uuid references public.crm_clients(id) on delete set null,
  chantier_id uuid references public.chantiers(id) on delete set null,
  titre text not null,
  description text,
  urgence text not null default 'normale',
  statut text not null default 'ouvert',
  assigned_to uuid default auth.uid(),
  photos jsonb not null default '[]'::jsonb,
  planned_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.crm_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'crm_sources','crm_tags','crm_pipeline_stages','crm_clients','crm_prospects',
    'crm_opportunities','crm_quotes','crm_quote_items','crm_tasks','crm_appointments',
    'crm_documents','crm_invoices','crm_sav'
  ]
  loop
    execute format('drop trigger if exists %I on public.%I', table_name || '_updated_at', table_name);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.crm_set_updated_at()',
      table_name || '_updated_at',
      table_name
    );
  end loop;
end $$;

insert into public.crm_pipeline_stages (organization_id, key, label, ordre, probability_default, is_won, is_lost)
select auth.uid(), seed.key, seed.label, seed.ordre, seed.probability_default, seed.is_won, seed.is_lost
from (values
  ('lead', 'Lead', 10, 10, false, false),
  ('qualification', 'Qualification', 20, 25, false, false),
  ('visite', 'Visite', 30, 40, false, false),
  ('chiffrage', 'Chiffrage', 40, 55, false, false),
  ('devis_envoye', 'Devis envoyé', 50, 65, false, false),
  ('negociation', 'Négociation', 60, 75, false, false),
  ('signature', 'Signature', 70, 90, false, false),
  ('gagne', 'Gagné', 80, 100, true, false),
  ('perdu', 'Perdu', 90, 0, false, true)
) as seed(key, label, ordre, probability_default, is_won, is_lost)
where auth.uid() is not null
on conflict (organization_id, key) do nothing;

create index if not exists crm_prospects_org_status_idx on public.crm_prospects (organization_id, statut, created_at desc);
create index if not exists crm_clients_org_name_idx on public.crm_clients (organization_id, nom, societe);
create index if not exists crm_opportunities_org_stage_idx on public.crm_opportunities (organization_id, stage_key, echeance);
create index if not exists crm_quotes_org_status_idx on public.crm_quotes (organization_id, statut, valid_until);
create index if not exists crm_tasks_org_due_idx on public.crm_tasks (organization_id, statut, due_at);
create index if not exists crm_appointments_org_start_idx on public.crm_appointments (organization_id, starts_at);
create index if not exists crm_sav_org_status_idx on public.crm_sav (organization_id, statut, created_at desc);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'crm_sources','crm_tags','crm_pipeline_stages','crm_clients','crm_prospects',
    'crm_opportunities','crm_quotes','crm_quote_items','crm_tasks','crm_appointments',
    'crm_documents','crm_notes','crm_communications','crm_invoices','crm_sav'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_select_own_org', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_insert_own_org', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_update_own_org', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_delete_own_org', table_name);
    execute format(
      'create policy %I on public.%I for select to authenticated using (organization_id = auth.uid())',
      table_name || '_select_own_org',
      table_name
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (organization_id = auth.uid())',
      table_name || '_insert_own_org',
      table_name
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (organization_id = auth.uid()) with check (organization_id = auth.uid())',
      table_name || '_update_own_org',
      table_name
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (organization_id = auth.uid())',
      table_name || '_delete_own_org',
      table_name
    );
  end loop;
end $$;
