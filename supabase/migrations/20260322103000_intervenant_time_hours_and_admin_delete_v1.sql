grant delete on table public.chantier_time_entries to authenticated;

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
  v_id uuid;
begin
  v_chantier_id := nullif(btrim(coalesce(p_payload ->> 'chantier_id', '')), '')::uuid;
  v_task_id := nullif(btrim(coalesce(p_payload ->> 'task_id', '')), '')::uuid;
  v_quantity := nullif(
    btrim(coalesce(p_payload ->> 'quantite_realisee', p_payload ->> 'quantity_done', p_payload ->> 'quantity', '')),
    ''
  )::numeric;
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

  if (v_hours is null or v_hours <= 0) and (v_quantity is null or v_quantity <= 0) then
    raise exception 'invalid_time_entry';
  end if;

  if v_hours is not null and v_hours <= 0 then
    raise exception 'invalid_duration_hours';
  end if;

  if v_quantity is not null and v_quantity <= 0 then
    raise exception 'invalid_quantite_realisee';
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
    note
  ) values (
    v_chantier_id,
    v_task_id,
    v_intervenant_id,
    v_work_date,
    v_hours,
    v_quantity,
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
