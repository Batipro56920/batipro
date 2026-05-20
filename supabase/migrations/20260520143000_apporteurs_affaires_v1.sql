-- Create apporteurs d'affaires tables and access tokens

create table if not exists public.apporteurs_affaires (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  nom text not null,
  entreprise text,
  type text not null,
  telephone text,
  email text,
  commission_percent numeric not null default 0,
  calculation_mode text not null default 'sur_estime',
  iban text,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists apporteurs_affaires_organization_id_idx on public.apporteurs_affaires (organization_id);

create table if not exists public.apporteur_leads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  apporteur_id uuid,
  client_name text not null,
  telephone text,
  project_address text,
  project_type text,
  estimated_amount numeric not null default 0,
  comment text,
  date date not null default current_date,
  status text not null default 'nouveau',
  commission_paid boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists apporteur_leads_organization_id_idx on public.apporteur_leads (organization_id);
create index if not exists apporteur_leads_apporteur_id_idx on public.apporteur_leads (apporteur_id);

create table if not exists public.apporteur_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  apporteur_id uuid not null,
  label text not null,
  file_path text not null,
  created_at timestamptz not null default now()
);

create index if not exists apporteur_documents_organization_id_idx on public.apporteur_documents (organization_id);
create index if not exists apporteur_documents_apporteur_id_idx on public.apporteur_documents (apporteur_id);

create table if not exists public.apporteur_access (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  apporteur_id uuid not null,
  token text not null unique,
  expires_at timestamptz,
  revoked_at timestamptz,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists apporteur_access_organization_id_idx on public.apporteur_access (organization_id);
create index if not exists apporteur_access_apporteur_id_idx on public.apporteur_access (apporteur_id);
