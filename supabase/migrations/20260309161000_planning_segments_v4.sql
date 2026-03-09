-- Planning v4: task planned duration + explicit planning segments fields.

do $$
begin
  if to_regclass('public.chantier_tasks') is not null then
    alter table public.chantier_tasks
      add column if not exists planned_duration_days numeric;

    update public.chantier_tasks
    set planned_duration_days = coalesce(planned_duration_days, duration_days, 1)
    where planned_duration_days is null;

    alter table public.chantier_tasks
      alter column planned_duration_days set default 1;

    update public.chantier_tasks
    set planned_duration_days = 1
    where planned_duration_days is null or planned_duration_days <= 0;

    alter table public.chantier_tasks
      alter column planned_duration_days set not null;
  end if;
end $$;

do $$
begin
  if to_regclass('public.chantier_tasks') is not null
     and not exists (
       select 1
       from pg_constraint
       where conrelid = 'public.chantier_tasks'::regclass
         and conname = 'chantier_tasks_planned_duration_days_chk'
     ) then
    alter table public.chantier_tasks
      add constraint chantier_tasks_planned_duration_days_chk
      check (planned_duration_days >= 0.25);
  end if;
end $$;

do $$
begin
  if to_regclass('public.chantier_task_segments') is not null then
    alter table public.chantier_task_segments
      add column if not exists start_date date,
      add column if not exists duration_days numeric,
      add column if not exists order_in_day integer;

    update public.chantier_task_segments
    set start_date = coalesce(start_date, (start_at at time zone 'UTC')::date)
    where start_date is null;

    update public.chantier_task_segments
    set duration_days = coalesce(
      duration_days,
      greatest(
        0.25,
        round((extract(epoch from (end_at - start_at)) / 86400.0)::numeric * 4) / 4
      )
    )
    where duration_days is null;

    update public.chantier_task_segments
    set order_in_day = 0
    where order_in_day is null;

    with ranked as (
      select
        id,
        row_number() over (
          partition by chantier_id, start_date
          order by coalesce(created_at, now()), id
        ) - 1 as rn
      from public.chantier_task_segments
    )
    update public.chantier_task_segments s
    set order_in_day = ranked.rn
    from ranked
    where ranked.id = s.id;

    alter table public.chantier_task_segments
      alter column start_date set not null,
      alter column duration_days set default 1,
      alter column duration_days set not null,
      alter column order_in_day set default 0,
      alter column order_in_day set not null;
  end if;
end $$;

do $$
begin
  if to_regclass('public.chantier_task_segments') is not null
     and not exists (
       select 1
       from pg_constraint
       where conrelid = 'public.chantier_task_segments'::regclass
         and conname = 'chantier_task_segments_duration_days_chk'
     ) then
    alter table public.chantier_task_segments
      add constraint chantier_task_segments_duration_days_chk
      check (duration_days >= 0.25);
  end if;
end $$;

create index if not exists chantier_task_segments_start_date_idx
  on public.chantier_task_segments (chantier_id, start_date, order_in_day);
