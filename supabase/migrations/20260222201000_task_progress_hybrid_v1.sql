-- Task progress hybrid mode (automatic by logged time + admin override)

alter table if exists public.chantier_tasks
  add column if not exists avancement_override_percent numeric null;

do $$
begin
  if to_regclass('public.chantier_tasks') is not null
     and not exists (
       select 1
       from pg_constraint
       where conrelid = 'public.chantier_tasks'::regclass
         and conname = 'chantier_tasks_avancement_override_percent_chk'
     ) then
    alter table public.chantier_tasks
      add constraint chantier_tasks_avancement_override_percent_chk
      check (
        avancement_override_percent is null
        or (avancement_override_percent >= 0 and avancement_override_percent <= 100)
      );
  end if;
end $$;

drop function if exists public.recompute_task_logged_hours(uuid);
create or replace function public.recompute_task_logged_hours(p_task_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_total numeric;
begin
  if p_task_id is null then
    return;
  end if;

  if to_regclass('public.chantier_tasks') is null or to_regclass('public.chantier_time_entries') is null then
    return;
  end if;

  select coalesce(sum(te.duration_hours), 0)
  into v_total
  from public.chantier_time_entries te
  where te.task_id = p_task_id;

  update public.chantier_tasks t
  set
    temps_reel_h = v_total,
    updated_at = now()
  where t.id = p_task_id;
end;
$$;

revoke all on function public.recompute_task_logged_hours(uuid) from public;

drop function if exists public.trg_sync_chantier_task_logged_hours();
create or replace function public.trg_sync_chantier_task_logged_hours()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recompute_task_logged_hours(old.task_id);
    return old;
  end if;

  if tg_op = 'UPDATE' then
    if new.task_id is distinct from old.task_id then
      perform public.recompute_task_logged_hours(old.task_id);
    end if;
    perform public.recompute_task_logged_hours(new.task_id);
    return new;
  end if;

  perform public.recompute_task_logged_hours(new.task_id);
  return new;
end;
$$;

revoke all on function public.trg_sync_chantier_task_logged_hours() from public;

do $$
begin
  if to_regclass('public.chantier_time_entries') is not null then
    drop trigger if exists trg_chantier_time_entries_sync_task_hours on public.chantier_time_entries;

    create trigger trg_chantier_time_entries_sync_task_hours
    after insert or update or delete on public.chantier_time_entries
    for each row execute function public.trg_sync_chantier_task_logged_hours();
  end if;
end $$;

-- Backfill only tasks that already have linked time entries.
do $$
begin
  if to_regclass('public.chantier_tasks') is not null
     and to_regclass('public.chantier_time_entries') is not null then
    update public.chantier_tasks t
    set temps_reel_h = src.total_hours
    from (
      select te.task_id, coalesce(sum(te.duration_hours), 0) as total_hours
      from public.chantier_time_entries te
      where te.task_id is not null
      group by te.task_id
    ) src
    where t.id = src.task_id;
  end if;
end $$;