-- Planning chantier: entries + dependencies

create table if not exists public.planning_entries (
  id uuid primary key default gen_random_uuid(),
  chantier_id uuid not null references public.chantiers(id) on delete cascade,
  task_id uuid not null references public.chantier_tasks(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  assigned_intervenant_ids uuid[] null,
  order_index integer default 0,
  is_locked boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists planning_entries_chantier_idx on public.planning_entries(chantier_id);
create index if not exists planning_entries_task_idx on public.planning_entries(task_id);

create table if not exists public.task_dependencies (
  id uuid primary key default gen_random_uuid(),
  chantier_id uuid not null references public.chantiers(id) on delete cascade,
  predecessor_task_id uuid not null references public.chantier_tasks(id) on delete cascade,
  successor_task_id uuid not null references public.chantier_tasks(id) on delete cascade,
  type text not null default 'FINISH_TO_START',
  created_at timestamptz default now()
);

create index if not exists task_dependencies_chantier_idx on public.task_dependencies(chantier_id);
create index if not exists task_dependencies_predecessor_idx on public.task_dependencies(predecessor_task_id);
create index if not exists task_dependencies_successor_idx on public.task_dependencies(successor_task_id);

alter table public.planning_entries enable row level security;
alter table public.task_dependencies enable row level security;

-- Updated_at trigger if available
do $$
begin
  if exists (select 1 from pg_proc where proname = 'set_updated_at') then
    drop trigger if exists trg_set_updated_at_planning_entries on public.planning_entries;
    create trigger trg_set_updated_at_planning_entries
    before update on public.planning_entries
    for each row execute function public.set_updated_at();
  end if;
end $$;

-- Admin only policies (uses public.is_admin() if present)
drop policy if exists "planning_entries_admin_all" on public.planning_entries;
drop policy if exists "task_dependencies_admin_all" on public.task_dependencies;

create policy "planning_entries_admin_all"
  on public.planning_entries
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "task_dependencies_admin_all"
  on public.task_dependencies
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
