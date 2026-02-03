create extension if not exists pgcrypto;

create table if not exists public.chantiers (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  client text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chantier_tasks (
  id uuid primary key default gen_random_uuid(),
  chantier_id uuid not null references public.chantiers(id) on delete cascade,
  titre text not null,
  corps_etat text,
  date date,
  status text not null default 'A_FAIRE',
  ordre int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.devis (
  id uuid primary key default gen_random_uuid(),
  chantier_id uuid not null references public.chantiers(id) on delete cascade,
  nom text not null,
  total_ht numeric,
  total_ttc numeric,
  created_at timestamptz not null default now()
);

create table if not exists public.devis_lines (
  id uuid primary key default gen_random_uuid(),
  devis_id uuid not null references public.devis(id) on delete cascade,
  lot text,
  designation text not null,
  quantite numeric not null default 1,
  unite text,
  prix_unitaire numeric not null default 0,
  total numeric not null default 0
);
