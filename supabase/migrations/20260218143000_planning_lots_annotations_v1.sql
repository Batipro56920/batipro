-- Nouveau module planning V2: lots + annotations + champs de projection

alter table public.chantiers
  add column if not exists start_date date,
  add column if not exists end_date date;

update public.chantiers
set
  start_date = coalesce(start_date, date_debut),
  end_date = coalesce(end_date, date_fin_prevue)
where start_date is null or end_date is null;

alter table public.chantier_tasks
  add column if not exists duration_days integer not null default 1,
  add column if not exists order_index integer not null default 0;

update public.chantier_tasks
set order_index = coalesce(order_index, 0)
where order_index is null;

update public.chantier_tasks
set duration_days = 1
where duration_days is null or duration_days < 1;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'chantier_tasks_duration_days_chk'
      and conrelid = 'public.chantier_tasks'::regclass
  ) then
    alter table public.chantier_tasks
      add constraint chantier_tasks_duration_days_chk check (duration_days >= 1);
  end if;
end $$;

create table if not exists public.chantier_lots (
  id uuid primary key default gen_random_uuid(),
  chantier_id uuid not null references public.chantiers(id) on delete cascade,
  name text not null,
  start_date date,
  end_date date,
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chantier_lots_unique_name unique (chantier_id, name),
  constraint chantier_lots_date_range_chk check (end_date is null or start_date is null or end_date >= start_date)
);

create index if not exists chantier_lots_chantier_idx on public.chantier_lots(chantier_id);
create index if not exists chantier_lots_chantier_order_idx on public.chantier_lots(chantier_id, order_index, name);

alter table public.chantier_lots enable row level security;

drop policy if exists chantier_lots_admin_all on public.chantier_lots;
create policy chantier_lots_admin_all
  on public.chantier_lots
  for all
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ADMIN'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ADMIN'));

drop trigger if exists trg_chantier_lots_updated_at on public.chantier_lots;
create trigger trg_chantier_lots_updated_at
before update on public.chantier_lots
for each row execute function public.set_updated_at();

create table if not exists public.planning_annotations (
  id uuid primary key default gen_random_uuid(),
  chantier_id uuid not null references public.chantiers(id) on delete cascade,
  lot_id uuid null references public.chantier_lots(id) on delete set null,
  task_id uuid null references public.chantier_tasks(id) on delete set null,
  intervenant_id uuid null references public.intervenants(id) on delete set null,
  date_start date not null,
  date_end date null,
  type text not null default 'info',
  message text not null default '',
  is_resolved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint planning_annotations_type_chk check (type in ('flag', 'warning', 'info')),
  constraint planning_annotations_date_range_chk check (date_end is null or date_end >= date_start)
);

create index if not exists planning_annotations_chantier_idx on public.planning_annotations(chantier_id);
create index if not exists planning_annotations_lot_idx on public.planning_annotations(lot_id);
create index if not exists planning_annotations_task_idx on public.planning_annotations(task_id);
create index if not exists planning_annotations_intervenant_idx on public.planning_annotations(intervenant_id);
create index if not exists planning_annotations_start_idx on public.planning_annotations(date_start);

alter table public.planning_annotations enable row level security;

drop policy if exists planning_annotations_admin_all on public.planning_annotations;
create policy planning_annotations_admin_all
  on public.planning_annotations
  for all
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ADMIN'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ADMIN'));

drop trigger if exists trg_planning_annotations_updated_at on public.planning_annotations;
create trigger trg_planning_annotations_updated_at
before update on public.planning_annotations
for each row execute function public.set_updated_at();

grant select, insert, update, delete on table public.chantier_lots to authenticated;
grant select, insert, update, delete on table public.planning_annotations to authenticated;

