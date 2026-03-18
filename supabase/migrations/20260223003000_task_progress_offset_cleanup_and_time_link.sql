-- Stabilize task progress: auto (time) + admin additive offset.
-- Cleanup legacy override and enforce time entries linked to a task.

alter table if exists public.chantier_tasks
  alter column progress_admin_offset_percent set default 0;

update public.chantier_tasks
set progress_admin_offset_percent = 0
where progress_admin_offset_percent is null;

alter table if exists public.chantier_tasks
  alter column progress_admin_offset_percent set not null;

drop function if exists public.admin_set_task_progress_override(uuid, numeric);

alter table if exists public.chantier_tasks
  drop column if exists progress_override_percent,
  drop column if exists progress_override_updated_at,
  drop column if exists progress_override_updated_by,
  drop column if exists avancement_override_percent;

create or replace view public.chantier_task_time_totals as
select
  te.task_id,
  coalesce(sum(te.duration_hours), 0)::numeric as total_hours
from public.chantier_time_entries te
where te.task_id is not null
group by te.task_id;

do $$
begin
  if to_regclass('public.chantier_time_entries') is not null
     and not exists (
       select 1
       from pg_constraint
       where conrelid = 'public.chantier_time_entries'::regclass
         and conname = 'chantier_time_entries_task_required_chk'
     ) then
    alter table public.chantier_time_entries
      add constraint chantier_time_entries_task_required_chk
      check (task_id is not null) not valid;
  end if;
end $$;

do $$
begin
  if to_regclass('public.chantier_time_entries') is not null
     and exists (
       select 1
       from pg_constraint
       where conrelid = 'public.chantier_time_entries'::regclass
         and conname = 'chantier_time_entries_task_required_chk'
     )
     and not exists (
       select 1
       from public.chantier_time_entries
       where task_id is null
     ) then
    alter table public.chantier_time_entries
      validate constraint chantier_time_entries_task_required_chk;
  end if;
end $$;

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
grant execute on function public.recompute_task_logged_hours(uuid) to authenticated;

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

create or replace function public.intervenant_time_create(
  p_token text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_chantier_id uuid;
  v_task_id uuid;
  v_intervenant_id uuid;
  v_hours numeric;
  v_work_date date;
  v_note text;
  v_id uuid;
begin
  v_chantier_id := nullif(btrim(coalesce(p_payload ->> 'chantier_id', '')), '')::uuid;
  v_task_id := nullif(btrim(coalesce(p_payload ->> 'task_id', '')), '')::uuid;
  v_hours := nullif(btrim(coalesce(p_payload ->> 'duration_hours', p_payload ->> 'hours')), '')::numeric;
  v_work_date := coalesce(
    nullif(btrim(coalesce(p_payload ->> 'work_date', '')), '')::date,
    current_date
  );
  v_note := nullif(btrim(coalesce(p_payload ->> 'note', '')), '');

  if v_chantier_id is null then
    raise exception 'chantier_id_required';
  end if;

  if v_task_id is null then
    raise exception 'task_id_required';
  end if;

  if v_hours is null or v_hours <= 0 then
    raise exception 'invalid_duration_hours';
  end if;

  v_intervenant_id := public._intervenant_assert_chantier_access(p_token, v_chantier_id);
  if v_intervenant_id is null then
    raise exception 'intervenant_required';
  end if;

  if not exists (
    select 1
    from public.chantier_tasks t
    where t.id = v_task_id
      and t.chantier_id = v_chantier_id
      and (
        t.intervenant_id = v_intervenant_id
        or exists (
          select 1
          from public.chantier_task_assignees cta
          where cta.task_id = t.id
            and cta.intervenant_id = v_intervenant_id
        )
      )
  ) then
    raise exception 'forbidden_task_scope';
  end if;

  insert into public.chantier_time_entries (
    chantier_id,
    task_id,
    intervenant_id,
    work_date,
    duration_hours,
    note
  ) values (
    v_chantier_id,
    v_task_id,
    v_intervenant_id,
    v_work_date,
    v_hours,
    v_note
  )
  returning id into v_id;

  perform public.recompute_task_logged_hours(v_task_id);

  return jsonb_build_object(
    'id', v_id,
    'chantier_id', v_chantier_id,
    'task_id', v_task_id,
    'intervenant_id', v_intervenant_id,
    'work_date', v_work_date,
    'duration_hours', v_hours,
    'note', v_note
  );
end;
$$;

revoke all on function public.intervenant_time_create(text, jsonb) from public;
grant execute on function public.intervenant_time_create(text, jsonb) to anon, authenticated;
