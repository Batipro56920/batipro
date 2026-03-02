-- Planning calendar v3: chantier settings + task merge metadata + fractional durations.

do $$
begin
  if to_regclass('public.chantiers') is not null then
    alter table public.chantiers
      add column if not exists planning_hours_per_day numeric not null default 7,
      add column if not exists planning_day_capacity numeric not null default 3,
      add column if not exists planning_working_days text[] not null default array['MON','TUE','WED','THU','FRI'];
  end if;
end $$;

do $$
begin
  if to_regclass('public.chantier_tasks') is not null then
    alter table public.chantier_tasks
      add column if not exists merged_from_task_ids uuid[] null;
  end if;
end $$;

do $$
begin
  if to_regclass('public.chantier_tasks') is not null then
    alter table public.chantier_tasks
      alter column duration_days type numeric using coalesce(duration_days, 1)::numeric,
      alter column duration_days set default 1;
  end if;
exception
  when undefined_column then
    null;
end $$;

do $$
begin
  if to_regclass('public.chantier_tasks') is not null
     and exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'chantier_tasks'
         and column_name = 'duration_days'
     )
     and not exists (
       select 1
       from pg_constraint
       where conrelid = 'public.chantier_tasks'::regclass
         and conname = 'chantier_tasks_duration_days_min_chk'
     ) then
    alter table public.chantier_tasks
      add constraint chantier_tasks_duration_days_min_chk
      check (duration_days >= 0.25);
  end if;
end $$;
