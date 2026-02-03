-- 1) Table intervenants
create table if not exists public.intervenants (
  id uuid primary key default gen_random_uuid(),
  chantier_id uuid not null references public.chantiers(id) on delete cascade,
  nom text not null,
  email text null,
  telephone text null,
  created_at timestamptz not null default now()
);

create index if not exists intervenants_chantier_id_idx
  on public.intervenants(chantier_id);

create unique index if not exists intervenants_unique_nom_par_chantier
  on public.intervenants(chantier_id, lower(nom));

-- 2) Lien sur chantier_tasks
alter table public.chantier_tasks
  add column if not exists intervenant_id uuid null references public.intervenants(id) on delete set null;
