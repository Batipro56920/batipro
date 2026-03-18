-- Task progress additive model: auto from time + admin offset

alter table if exists public.chantier_tasks
  add column if not exists progress_admin_offset_percent numeric null default 0,
  add column if not exists progress_admin_offset_updated_at timestamptz null,
  add column if not exists progress_admin_offset_updated_by uuid null;

do $$
begin
  if to_regclass('public.chantier_tasks') is not null
     and not exists (
       select 1
       from pg_constraint
       where conrelid = 'public.chantier_tasks'::regclass
         and conname = 'chantier_tasks_progress_admin_offset_percent_chk'
     ) then
    alter table public.chantier_tasks
      add constraint chantier_tasks_progress_admin_offset_percent_chk
      check (
        progress_admin_offset_percent is null
        or (progress_admin_offset_percent >= -100 and progress_admin_offset_percent <= 100)
      );
  end if;
end $$;

do $$
begin
  if to_regclass('public.chantier_tasks') is not null
     and not exists (
       select 1
       from pg_constraint
       where conrelid = 'public.chantier_tasks'::regclass
         and conname = 'chantier_tasks_progress_admin_offset_updated_by_fkey'
     ) then
    alter table public.chantier_tasks
      add constraint chantier_tasks_progress_admin_offset_updated_by_fkey
      foreign key (progress_admin_offset_updated_by)
      references auth.users(id)
      on delete set null;
  end if;
end $$;

-- Backfill offset from legacy override (when present) so prior behavior remains close.
do $$
begin
  if to_regclass('public.chantier_tasks') is not null then
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'chantier_tasks'
        and column_name = 'progress_override_percent'
    ) then
      execute $sql$
        update public.chantier_tasks t
        set progress_admin_offset_percent = greatest(
          -100,
          least(
            100,
            coalesce(t.progress_override_percent, 0)
            - coalesce(
                case
                  when t.temps_prevu_h is null or t.temps_prevu_h <= 0 then null
                  else (coalesce(t.temps_reel_h, 0)::numeric / nullif(t.temps_prevu_h::numeric, 0)) * 100
                end,
                0
              )
          )
        )
        where (t.progress_admin_offset_percent is null)
          and t.progress_override_percent is not null
      $sql$;
    end if;

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'chantier_tasks'
        and column_name = 'avancement_override_percent'
    ) then
      execute $sql$
        update public.chantier_tasks t
        set progress_admin_offset_percent = greatest(
          -100,
          least(
            100,
            coalesce(t.avancement_override_percent, 0)
            - coalesce(
                case
                  when t.temps_prevu_h is null or t.temps_prevu_h <= 0 then null
                  else (coalesce(t.temps_reel_h, 0)::numeric / nullif(t.temps_prevu_h::numeric, 0)) * 100
                end,
                0
              )
          )
        )
        where (t.progress_admin_offset_percent is null)
          and t.avancement_override_percent is not null
      $sql$;
    end if;

    update public.chantier_tasks
    set progress_admin_offset_percent = 0
    where progress_admin_offset_percent is null;
  end if;
end $$;

drop function if exists public.task_progress_auto_percent(numeric, numeric);
create or replace function public.task_progress_auto_percent(
  p_temps_reel_h numeric,
  p_temps_prevu_h numeric
)
returns numeric
language sql
immutable
as $$
  select case
    when p_temps_prevu_h is null or p_temps_prevu_h <= 0 then null
    else greatest(0, least(100, (coalesce(p_temps_reel_h, 0) / nullif(p_temps_prevu_h, 0)) * 100))
  end
$$;

drop function if exists public.task_progress_final_percent(numeric, numeric, numeric);
create or replace function public.task_progress_final_percent(
  p_temps_reel_h numeric,
  p_temps_prevu_h numeric,
  p_offset numeric
)
returns numeric
language sql
immutable
as $$
  select greatest(
    0,
    least(
      100,
      coalesce(public.task_progress_auto_percent(p_temps_reel_h, p_temps_prevu_h), 0) + coalesce(p_offset, 0)
    )
  )
$$;

drop function if exists public.trg_chantier_tasks_sync_status_from_progress();
create or replace function public.trg_chantier_tasks_sync_status_from_progress()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_final numeric;
begin
  v_final := public.task_progress_final_percent(
    new.temps_reel_h::numeric,
    new.temps_prevu_h::numeric,
    new.progress_admin_offset_percent::numeric
  );

  if v_final >= 100 then
    new.status := 'FAIT';
  elsif v_final > 0 then
    new.status := 'EN_COURS';
  else
    new.status := 'A_FAIRE';
  end if;

  return new;
end;
$$;

do $$
begin
  if to_regclass('public.chantier_tasks') is not null then
    drop trigger if exists trg_chantier_tasks_sync_status_from_progress on public.chantier_tasks;
    create trigger trg_chantier_tasks_sync_status_from_progress
    before insert or update of temps_reel_h, temps_prevu_h, progress_admin_offset_percent
    on public.chantier_tasks
    for each row execute function public.trg_chantier_tasks_sync_status_from_progress();

    update public.chantier_tasks t
    set status = case
      when public.task_progress_final_percent(
        t.temps_reel_h::numeric,
        t.temps_prevu_h::numeric,
        t.progress_admin_offset_percent::numeric
      ) >= 100 then 'FAIT'
      when public.task_progress_final_percent(
        t.temps_reel_h::numeric,
        t.temps_prevu_h::numeric,
        t.progress_admin_offset_percent::numeric
      ) > 0 then 'EN_COURS'
      else 'A_FAIRE'
    end;
  end if;
end $$;

drop function if exists public.admin_set_task_progress_offset(uuid, numeric);
create or replace function public.admin_set_task_progress_offset(
  p_task_id uuid,
  p_offset numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_offset numeric;
  v_task record;
begin
  if auth.uid() is null then
    raise exception 'forbidden';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'ADMIN'
  ) then
    raise exception 'forbidden';
  end if;

  if p_task_id is null then
    raise exception 'task_id_required';
  end if;

  v_offset := case
    when p_offset is null then 0
    else greatest(-100, least(100, p_offset))
  end;

  update public.chantier_tasks t
  set
    progress_admin_offset_percent = v_offset,
    progress_admin_offset_updated_at = now(),
    progress_admin_offset_updated_by = auth.uid(),
    updated_at = now()
  where t.id = p_task_id
  returning
    t.id,
    t.chantier_id,
    t.status,
    t.progress_admin_offset_percent,
    t.progress_admin_offset_updated_at,
    t.progress_admin_offset_updated_by
  into v_task;

  if v_task is null then
    raise exception 'task_not_found';
  end if;

  return jsonb_build_object(
    'id', v_task.id,
    'chantier_id', v_task.chantier_id,
    'status', v_task.status,
    'progress_admin_offset_percent', v_task.progress_admin_offset_percent,
    'progress_admin_offset_updated_at', v_task.progress_admin_offset_updated_at,
    'progress_admin_offset_updated_by', v_task.progress_admin_offset_updated_by
  );
end;
$$;

revoke all on function public.admin_set_task_progress_offset(uuid, numeric) from public;
grant execute on function public.admin_set_task_progress_offset(uuid, numeric) to authenticated;
