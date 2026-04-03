create table if not exists public.chantier_task_steps (
  id uuid primary key default gen_random_uuid(),
  chantier_id uuid not null references public.chantiers(id) on delete cascade,
  task_id uuid not null references public.chantier_tasks(id) on delete cascade,
  titre text not null,
  statut text not null default 'a_faire',
  ordre integer not null default 0,
  commentaire text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chantier_task_steps_statut_chk check (statut in ('a_faire', 'en_cours', 'termine'))
);

create index if not exists chantier_task_steps_chantier_idx
  on public.chantier_task_steps (chantier_id, task_id, ordre, created_at);

create index if not exists chantier_task_steps_task_idx
  on public.chantier_task_steps (task_id, ordre, created_at);

alter table public.chantier_task_steps enable row level security;

drop policy if exists chantier_task_steps_auth_all on public.chantier_task_steps;
create policy chantier_task_steps_auth_all
  on public.chantier_task_steps
  for all
  to authenticated
  using (true)
  with check (true);
