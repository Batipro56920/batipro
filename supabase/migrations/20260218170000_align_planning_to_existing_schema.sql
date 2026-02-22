-- Align planning schema with existing Batipro tables (no chantier_lots dependency)

alter table public.chantiers
  add column if not exists planning_start_date date,
  add column if not exists planning_end_date date,
  add column if not exists planning_skip_weekends boolean not null default false;

update public.chantiers
set
  planning_start_date = coalesce(planning_start_date, date_debut),
  planning_end_date = coalesce(planning_end_date, date_fin_prevue)
where planning_start_date is null
   or planning_end_date is null;

alter table public.chantier_tasks
  add column if not exists duration_days integer not null default 1,
  add column if not exists order_index integer not null default 0;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'chantier_tasks'
      and column_name = 'ordre'
  ) then
    execute '
      update public.chantier_tasks
      set
        duration_days = greatest(1, coalesce(duration_days, 1)),
        order_index = greatest(0, coalesce(order_index, ordre, 0))
      where duration_days is null
         or duration_days < 1
         or order_index is null
         or order_index < 0
    ';

    -- one-shot migration: legacy ordre -> order_index (order_index devient la source unique)
    execute '
      update public.chantier_tasks
      set order_index = greatest(0, coalesce(ordre, 0))
      where coalesce(order_index, 0) = 0
        and coalesce(ordre, 0) <> 0
    ';
  else
    execute '
      update public.chantier_tasks
      set
        duration_days = greatest(1, coalesce(duration_days, 1)),
        order_index = greatest(0, coalesce(order_index, 0))
      where duration_days is null
         or duration_days < 1
         or order_index is null
         or order_index < 0
    ';
  end if;
end $$;

update public.chantier_tasks
set duration_days = 1
where duration_days < 1;

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

create table if not exists public.chantier_lot_planning (
  id uuid primary key default gen_random_uuid(),
  chantier_id uuid not null references public.chantiers(id) on delete cascade,
  lot_name text not null,
  start_date date null,
  end_date date null,
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chantier_lot_planning_unique unique (chantier_id, lot_name),
  constraint chantier_lot_planning_range_chk check (end_date is null or start_date is null or end_date >= start_date)
);

create index if not exists chantier_lot_planning_chantier_idx on public.chantier_lot_planning(chantier_id);
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'chantier_lot_planning'
      and column_name = 'lot'
  ) then
    execute 'create index if not exists chantier_lot_planning_order_idx on public.chantier_lot_planning(chantier_id, order_index, lot)';
  elsif exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'chantier_lot_planning'
      and column_name = 'lot_name'
  ) then
    execute 'create index if not exists chantier_lot_planning_order_idx on public.chantier_lot_planning(chantier_id, order_index, lot_name)';
  end if;
end $$;

alter table public.chantier_lot_planning enable row level security;

drop policy if exists chantier_lot_planning_admin_all on public.chantier_lot_planning;
create policy chantier_lot_planning_admin_all
  on public.chantier_lot_planning
  for all
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ADMIN'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ADMIN'));

do $$
begin
  if exists (select 1 from pg_proc where proname = 'set_updated_at') then
    drop trigger if exists trg_chantier_lot_planning_updated_at on public.chantier_lot_planning;
    create trigger trg_chantier_lot_planning_updated_at
    before update on public.chantier_lot_planning
    for each row execute function public.set_updated_at();
  end if;
end $$;

grant select, insert, update, delete on table public.chantier_lot_planning to authenticated;

alter table if exists public.planning_annotations
  add column if not exists lot_name text;

create index if not exists planning_annotations_lot_name_idx on public.planning_annotations(chantier_id, lot_name);
