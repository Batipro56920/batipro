alter table if exists public.chantier_time_entries
  add column if not exists progress_percent numeric null;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'chantier_time_entries_progress_percent_chk'
  ) then
    alter table public.chantier_time_entries
      drop constraint chantier_time_entries_progress_percent_chk;
  end if;

  alter table public.chantier_time_entries
    add constraint chantier_time_entries_progress_percent_chk
    check (progress_percent is null or (progress_percent >= 0 and progress_percent <= 100));
end $$;

drop function if exists public.recompute_task_logged_hours(uuid);
create or replace function public.recompute_task_logged_hours(p_task_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_total_hours numeric := 0;
  v_total_quantity numeric := 0;
  v_latest_progress_percent numeric := null;
  v_task_quantity numeric := null;
begin
  if p_task_id is null then
    return;
  end if;

  if to_regclass('public.chantier_tasks') is null or to_regclass('public.chantier_time_entries') is null then
    return;
  end if;

  select t.quantite::numeric
  into v_task_quantity
  from public.chantier_tasks t
  where t.id = p_task_id;

  select
    coalesce(sum(te.duration_hours), 0),
    coalesce(sum(te.quantite_realisee), 0)
  into v_total_hours, v_total_quantity
  from public.chantier_time_entries te
  where te.task_id = p_task_id;

  select te.progress_percent
  into v_latest_progress_percent
  from public.chantier_time_entries te
  where te.task_id = p_task_id
    and te.progress_percent is not null
  order by te.work_date desc, te.created_at desc nulls last
  limit 1;

  update public.chantier_tasks t
  set
    temps_reel_h = v_total_hours,
    quantite_realisee = case
      when v_latest_progress_percent is not null and coalesce(v_task_quantity, 0) > 0 then
        greatest(0, least(v_task_quantity, round((v_task_quantity * v_latest_progress_percent) / 100.0, 4)))
      else
        v_total_quantity
    end,
    updated_at = now()
  where t.id = p_task_id;
end;
$$;

revoke all on function public.recompute_task_logged_hours(uuid) from public;
grant execute on function public.recompute_task_logged_hours(uuid) to authenticated;

drop function if exists public.intervenant_time_create(text, jsonb);
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
  v_work_date date;
  v_note text;
  v_quantity numeric;
  v_hours numeric;
  v_progress_percent numeric;
  v_id uuid;
begin
  v_chantier_id := nullif(btrim(coalesce(p_payload ->> 'chantier_id', '')), '')::uuid;
  v_task_id := nullif(btrim(coalesce(p_payload ->> 'task_id', '')), '')::uuid;
  v_quantity := nullif(
    btrim(coalesce(p_payload ->> 'quantite_realisee', p_payload ->> 'quantity_done', p_payload ->> 'quantity', '')),
    ''
  )::numeric;
  v_hours := nullif(btrim(coalesce(p_payload ->> 'duration_hours', p_payload ->> 'hours')), '')::numeric;
  v_progress_percent := nullif(
    btrim(coalesce(p_payload ->> 'progress_percent', p_payload ->> 'progress', '')),
    ''
  )::numeric;
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

  if (v_hours is null or v_hours <= 0) and (v_quantity is null or v_quantity <= 0) then
    raise exception 'invalid_time_entry';
  end if;

  if v_hours is not null and v_hours <= 0 then
    raise exception 'invalid_duration_hours';
  end if;

  if v_quantity is not null and v_quantity <= 0 then
    raise exception 'invalid_quantite_realisee';
  end if;

  if v_progress_percent is not null and (v_progress_percent < 0 or v_progress_percent > 100) then
    raise exception 'invalid_progress_percent';
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
    quantite_realisee,
    progress_percent,
    note
  ) values (
    v_chantier_id,
    v_task_id,
    v_intervenant_id,
    v_work_date,
    v_hours,
    v_quantity,
    v_progress_percent,
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
    'quantite_realisee', v_quantity,
    'progress_percent', v_progress_percent,
    'note', v_note
  );
end;
$$;

revoke all on function public.intervenant_time_create(text, jsonb) from public;
grant execute on function public.intervenant_time_create(text, jsonb) to anon, authenticated;

drop function if exists public.intervenant_time_list(text, uuid);
create or replace function public.intervenant_time_list(
  p_token text,
  p_chantier_id uuid
)
returns table (
  id uuid,
  chantier_id uuid,
  task_id uuid,
  task_titre text,
  task_unite text,
  intervenant_id uuid,
  work_date date,
  duration_hours numeric,
  quantite_realisee numeric,
  progress_percent numeric,
  note text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_intervenant_id uuid;
begin
  v_intervenant_id := public._intervenant_assert_chantier_access(p_token, p_chantier_id);
  if v_intervenant_id is null then
    raise exception 'intervenant_required';
  end if;

  return query
  select
    te.id,
    te.chantier_id,
    te.task_id,
    t.titre as task_titre,
    t.unite as task_unite,
    te.intervenant_id,
    te.work_date,
    te.duration_hours,
    te.quantite_realisee,
    te.progress_percent,
    te.note,
    te.created_at
  from public.chantier_time_entries te
  left join public.chantier_tasks t
    on t.id = te.task_id
  where te.chantier_id = p_chantier_id
    and te.intervenant_id = v_intervenant_id
  order by te.work_date desc, te.created_at desc;
end;
$$;

revoke all on function public.intervenant_time_list(text, uuid) from public;
grant execute on function public.intervenant_time_list(text, uuid) to anon, authenticated;
