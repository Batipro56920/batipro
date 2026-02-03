-- Token robuste
create extension if not exists pgcrypto;

-- Table d’accès intervenant (1 lien par intervenant + chantier)
create table if not exists public.chantier_intervenant_access (
  id uuid primary key default gen_random_uuid(),

  chantier_id uuid not null references public.chantiers(id) on delete cascade,
  intervenant_id uuid not null references public.intervenants(id) on delete cascade,

  token text not null unique,
  role text not null default 'INTERVENANT',

  enabled boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- V1 : 1 accès actif unique par couple (chantier, intervenant)
  constraint chantier_intervenant_access_unique unique (chantier_id, intervenant_id)
);

-- updated_at auto
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_access_updated_at on public.chantier_intervenant_access;
create trigger trg_access_updated_at
before update on public.chantier_intervenant_access
for each row execute function public.set_updated_at();

-- Index utiles
create index if not exists idx_access_chantier on public.chantier_intervenant_access (chantier_id);
create index if not exists idx_access_intervenant on public.chantier_intervenant_access (intervenant_id);
create index if not exists idx_access_enabled on public.chantier_intervenant_access (enabled);
