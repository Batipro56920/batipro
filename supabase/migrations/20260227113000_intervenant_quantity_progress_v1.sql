-- Quantity-first progress for intervenant portal time entries.

do $$
begin
  if to_regclass('public.chantier_time_entries') is not null then
    alter table public.chantier_time_entries
      add column if not exists quantite_realisee numeric null;

    alter table public.chantier_time_entries
      alter column duration_hours drop not null;
  end if;
end $$;

do $$
begin
  if to_regclass('public.chantier_time_entries') is not null
     and not exists (
       select 1
       from pg_constraint
       where conrelid = 'public.chantier_time_entries'::regclass
         and conname = 'chantier_time_entries_quantite_realisee_chk'
     ) then
    alter table public.chantier_time_entries
      add constraint chantier_time_entries_quantite_realisee_chk
      check (quantite_realisee is null or quantite_realisee > 0);
  end if;
end $$;

do $$
begin
  if to_regclass('public.chantier_tasks') is not null then
    alter table public.chantier_tasks
      add column if not exists quantite_realisee numeric;

    update public.chantier_tasks
    set quantite_realisee = coalesce(quantite_realisee, 0)
    where quantite_realisee is null;

    alter table public.chantier_tasks
      alter column quantite_realisee set default 0,
      alter column quantite_realisee set not null;
  end if;
end $$;

do $$
begin
  if to_regclass('public.chantier_tasks') is not null
     and not exists (
       select 1
       from pg_constraint
       where conrelid = 'public.chantier_tasks'::regclass
         and conname = 'chantier_tasks_quantite_realisee_chk'
     ) then
    alter table public.chantier_tasks
      add constraint chantier_tasks_quantite_realisee_chk
      check (quantite_realisee >= 0);
  end if;
end $$;

create or replace function public.recompute_task_logged_hours(p_task_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_total_hours numeric;
  v_total_quantity numeric;
begin
  if p_task_id is null then
    return;
  end if;

  if to_regclass('public.chantier_tasks') is null or to_regclass('public.chantier_time_entries') is null then
    return;
  end if;

  select
    coalesce(sum(te.duration_hours), 0),
    coalesce(sum(te.quantite_realisee), 0)
  into v_total_hours, v_total_quantity
  from public.chantier_time_entries te
  where te.task_id = p_task_id;

  update public.chantier_tasks t
  set
    temps_reel_h = v_total_hours,
    quantite_realisee = v_total_quantity,
    updated_at = now()
  where t.id = p_task_id;
end;
$$;

create or replace function public.task_progress_auto_percent_v2(
  p_quantite_realisee numeric,
  p_quantite_totale numeric,
  p_temps_reel_h numeric,
  p_temps_prevu_h numeric
)
returns numeric
language sql
immutable
as $$
  select case
    when p_quantite_totale is not null and p_quantite_totale > 0 then
      greatest(0, least(100, (coalesce(p_quantite_realisee, 0) / nullif(p_quantite_totale, 0)) * 100))
    when p_temps_prevu_h is null or p_temps_prevu_h <= 0 then
      null
    else
      greatest(0, least(100, (coalesce(p_temps_reel_h, 0) / nullif(p_temps_prevu_h, 0)) * 100))
  end
$$;

create or replace function public.task_progress_final_percent_v2(
  p_quantite_realisee numeric,
  p_quantite_totale numeric,
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
      coalesce(
        public.task_progress_auto_percent_v2(
          p_quantite_realisee,
          p_quantite_totale,
          p_temps_reel_h,
          p_temps_prevu_h
        ),
        0
      ) + coalesce(p_offset, 0)
    )
  )
$$;

create or replace function public.trg_chantier_tasks_sync_status_from_progress()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_final numeric;
begin
  v_final := public.task_progress_final_percent_v2(
    new.quantite_realisee::numeric,
    new.quantite::numeric,
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
    before insert or update of quantite, quantite_realisee, temps_reel_h, temps_prevu_h, progress_admin_offset_percent
    on public.chantier_tasks
    for each row execute function public.trg_chantier_tasks_sync_status_from_progress();

    update public.chantier_tasks t
    set status = case
      when public.task_progress_final_percent_v2(
        t.quantite_realisee::numeric,
        t.quantite::numeric,
        t.temps_reel_h::numeric,
        t.temps_prevu_h::numeric,
        t.progress_admin_offset_percent::numeric
      ) >= 100 then 'FAIT'
      when public.task_progress_final_percent_v2(
        t.quantite_realisee::numeric,
        t.quantite::numeric,
        t.temps_reel_h::numeric,
        t.temps_prevu_h::numeric,
        t.progress_admin_offset_percent::numeric
      ) > 0 then 'EN_COURS'
      else 'A_FAIRE'
    end;
  end if;
end $$;

do $$
begin
  if to_regclass('public.chantier_time_entries') is not null
     and to_regclass('public.chantier_tasks') is not null then
    update public.chantier_tasks t
    set quantite_realisee = src.total_quantity
    from (
      select te.task_id, coalesce(sum(te.quantite_realisee), 0) as total_quantity
      from public.chantier_time_entries te
      where te.task_id is not null
      group by te.task_id
    ) src
    where t.id = src.task_id;
  end if;
end $$;

drop function if exists public.intervenant_get_tasks(text, uuid);
create or replace function public.intervenant_get_tasks(p_token text, p_chantier_id uuid)
returns table (
  id uuid,
  chantier_id uuid,
  titre text,
  status text,
  lot text,
  corps_etat text,
  date date,
  date_debut date,
  date_fin date,
  quantite numeric,
  quantite_realisee numeric,
  unite text,
  temps_prevu_h numeric,
  temps_reel_h numeric,
  duration_days integer,
  order_index integer,
  intervenant_id uuid,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_intervenant_id uuid;
begin
  v_intervenant_id := public._intervenant_assert_chantier_access(p_token, p_chantier_id);

  return query
  select
    t.id,
    t.chantier_id,
    t.titre,
    t.status,
    t.lot,
    t.corps_etat,
    t.date,
    t.date_debut,
    t.date_fin,
    t.quantite,
    t.quantite_realisee,
    t.unite,
    t.temps_prevu_h,
    t.temps_reel_h,
    greatest(coalesce(t.duration_days, 1), 1)::integer as duration_days,
    greatest(coalesce(t.order_index, 0), 0)::integer as order_index,
    t.intervenant_id,
    t.updated_at
  from public.chantier_tasks t
  where t.chantier_id = p_chantier_id
    and (
      v_intervenant_id is null
      or t.intervenant_id = v_intervenant_id
      or exists (
        select 1
        from public.chantier_task_assignees cta
        where cta.task_id = t.id
          and cta.intervenant_id = v_intervenant_id
      )
    )
  order by coalesce(t.order_index, 0), coalesce(t.created_at, now()), t.titre;
end;
$$;

revoke all on function public.intervenant_get_tasks(text, uuid) from public;
grant execute on function public.intervenant_get_tasks(text, uuid) to anon, authenticated;

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

  if v_quantity is null or v_quantity <= 0 then
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
    'quantite_realisee', v_quantity,
    'duration_hours', v_hours,
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
