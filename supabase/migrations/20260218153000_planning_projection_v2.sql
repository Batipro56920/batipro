-- Planning V2: champs planning_* et projection des dates

alter table public.chantiers
  add column if not exists planning_start_date date,
  add column if not exists planning_end_date date,
  add column if not exists planning_skip_weekends boolean not null default false;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'chantiers' and column_name = 'start_date'
  ) then
    execute '
      update public.chantiers
      set planning_start_date = coalesce(planning_start_date, start_date, date_debut)
      where planning_start_date is null
    ';
  else
    execute '
      update public.chantiers
      set planning_start_date = coalesce(planning_start_date, date_debut)
      where planning_start_date is null
    ';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'chantiers' and column_name = 'end_date'
  ) then
    execute '
      update public.chantiers
      set planning_end_date = coalesce(planning_end_date, end_date, date_fin_prevue)
      where planning_end_date is null
    ';
  else
    execute '
      update public.chantiers
      set planning_end_date = coalesce(planning_end_date, date_fin_prevue)
      where planning_end_date is null
    ';
  end if;
end $$;

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

create table if not exists public.chantier_lots (
  id uuid primary key default gen_random_uuid(),
  chantier_id uuid not null references public.chantiers(id) on delete cascade,
  name text not null,
  planning_start_date date,
  planning_end_date date,
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chantier_lots_unique_name unique (chantier_id, name),
  constraint chantier_lots_planning_date_range_chk check (
    planning_end_date is null or planning_start_date is null or planning_end_date >= planning_start_date
  )
);

alter table public.chantier_lots
  add column if not exists planning_start_date date,
  add column if not exists planning_end_date date,
  add column if not exists order_index integer not null default 0;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'chantier_lots' and column_name = 'start_date'
  ) then
    execute '
      update public.chantier_lots
      set planning_start_date = coalesce(planning_start_date, start_date)
      where planning_start_date is null
    ';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'chantier_lots' and column_name = 'end_date'
  ) then
    execute '
      update public.chantier_lots
      set planning_end_date = coalesce(planning_end_date, end_date)
      where planning_end_date is null
    ';
  end if;
end $$;

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

grant select, insert, update, delete on table public.chantier_lots to authenticated;
