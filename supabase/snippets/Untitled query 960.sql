-- 001_intervenants.sql

-- 1) Table intervenants
create table if not exists public.intervenants (
  id uuid primary key default gen_random_uuid(),
  chantier_id uuid not null references public.chantiers(id) on delete cascade,
  nom text not null,
  created_at timestamptz not null default now()
);

create index if not exists intervenants_chantier_id_idx
on public.intervenants(chantier_id);

-- 2) Ajout de la FK sur chantier_tasks
alter table public.chantier_tasks
add column if not exists intervenant_id uuid null references public.intervenants(id) on delete set null;

create index if not exists chantier_tasks_intervenant_id_idx
on public.chantier_tasks(intervenant_id);
