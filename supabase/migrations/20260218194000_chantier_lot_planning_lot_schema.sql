-- Ensure chantier_lot_planning exists with lot column (schema expected by Planning V1)

create table if not exists public.chantier_lot_planning (
  id uuid primary key default gen_random_uuid(),
  chantier_id uuid not null references public.chantiers(id) on delete cascade,
  lot text not null,
  start_date date null,
  end_date date null,
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chantier_lot_planning_range_chk check (
    end_date is null or start_date is null or end_date >= start_date
  )
);

-- Backward compatibility when an older variant used lot_name
alter table if exists public.chantier_lot_planning
  add column if not exists lot text;

update public.chantier_lot_planning
set lot = nullif(trim(lot), '')
where lot is null
   or trim(lot) = '';

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'chantier_lot_planning'
      and column_name = 'lot_name'
  ) then
    execute $sql$
      update public.chantier_lot_planning
      set lot = nullif(trim(coalesce(lot, lot_name, '')), '')
      where lot is null
         or trim(lot) = ''
    $sql$;
  end if;
end $$;

update public.chantier_lot_planning
set lot = 'A classer'
where lot is null
   or trim(lot) = '';

alter table public.chantier_lot_planning
  alter column lot set not null;

create unique index if not exists chantier_lot_planning_chantier_lot_uniq
  on public.chantier_lot_planning(chantier_id, lot);

create index if not exists chantier_lot_planning_chantier_idx
  on public.chantier_lot_planning(chantier_id);

create index if not exists chantier_lot_planning_order_idx
  on public.chantier_lot_planning(chantier_id, order_index, lot);

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

