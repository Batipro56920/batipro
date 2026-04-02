drop function if exists public.intervenant_reserve_list(text, uuid);
create or replace function public.intervenant_reserve_list(
  p_token text,
  p_chantier_id uuid default null
)
returns table (
  id uuid,
  chantier_id uuid,
  chantier_nom text,
  task_id uuid,
  task_titre text,
  title text,
  description text,
  status text,
  priority text,
  intervenant_id uuid,
  levee_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ctx record;
begin
  select *
  into v_ctx
  from public._intervenant_token_context_v2(p_token)
  limit 1;

  if v_ctx.intervenant_id is null then
    raise exception 'intervenant_required';
  end if;

  if p_chantier_id is not null then
    perform public._intervenant_assert_chantier_access(p_token, p_chantier_id);
  end if;

  return query
  select
    r.id,
    r.chantier_id,
    c.nom as chantier_nom,
    r.task_id,
    case
      when t.id is null then null
      else coalesce(nullif(btrim(t.titre_terrain), ''), nullif(btrim(t.titre), ''), 'Sans titre')
    end as task_titre,
    coalesce(nullif(btrim(r.title), ''), 'Reserve') as title,
    r.description,
    coalesce(nullif(btrim(r.status), ''), 'OUVERTE') as status,
    coalesce(nullif(btrim(r.priority), ''), 'NORMALE') as priority,
    r.intervenant_id,
    r.levee_at,
    r.created_at,
    r.updated_at
  from public.chantier_reserves r
  join public.chantiers c on c.id = r.chantier_id
  left join public.chantier_tasks t on t.id = r.task_id
  where (
      (p_chantier_id is null and r.chantier_id = any(v_ctx.chantier_ids))
      or (p_chantier_id is not null and r.chantier_id = p_chantier_id)
    )
    and (
      r.intervenant_id is null
      or r.intervenant_id = v_ctx.intervenant_id
      or exists (
        select 1
        from public.chantier_task_assignees cta
        where cta.task_id = r.task_id
          and cta.intervenant_id = v_ctx.intervenant_id
      )
    )
  order by
    case when coalesce(nullif(btrim(r.status), ''), 'OUVERTE') = 'LEVEE' then 1 else 0 end asc,
    r.created_at desc;
end;
$$;

revoke all on function public.intervenant_reserve_list(text, uuid) from public;
grant execute on function public.intervenant_reserve_list(text, uuid) to anon, authenticated;

drop function if exists public.intervenant_reserve_mark_lifted(text, uuid);
create or replace function public.intervenant_reserve_mark_lifted(
  p_token text,
  p_reserve_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ctx record;
  v_existing public.chantier_reserves%rowtype;
  v_task_titre text;
begin
  if p_reserve_id is null then
    raise exception 'reserve_id_required';
  end if;

  select *
  into v_ctx
  from public._intervenant_token_context_v2(p_token)
  limit 1;

  if v_ctx.intervenant_id is null then
    raise exception 'intervenant_required';
  end if;

  select *
  into v_existing
  from public.chantier_reserves
  where id = p_reserve_id
  limit 1;

  if v_existing.id is null then
    raise exception 'reserve_not_found';
  end if;

  perform public._intervenant_assert_chantier_access(p_token, v_existing.chantier_id);

  if v_existing.intervenant_id is not null
     and v_existing.intervenant_id <> v_ctx.intervenant_id
     and not exists (
       select 1
       from public.chantier_task_assignees cta
       where cta.task_id = v_existing.task_id
         and cta.intervenant_id = v_ctx.intervenant_id
     ) then
    raise exception 'forbidden_reserve_scope';
  end if;

  update public.chantier_reserves
  set
    status = 'LEVEE',
    levee_at = coalesce(levee_at, now()),
    updated_at = now()
  where id = p_reserve_id
  returning * into v_existing;

  select coalesce(nullif(btrim(t.titre_terrain), ''), nullif(btrim(t.titre), ''), 'Sans titre')
  into v_task_titre
  from public.chantier_tasks t
  where t.id = v_existing.task_id
  limit 1;

  return jsonb_build_object(
    'id', v_existing.id,
    'chantier_id', v_existing.chantier_id,
    'task_id', v_existing.task_id,
    'task_titre', v_task_titre,
    'title', coalesce(nullif(btrim(v_existing.title), ''), 'Reserve'),
    'description', v_existing.description,
    'status', coalesce(nullif(btrim(v_existing.status), ''), 'LEVEE'),
    'priority', coalesce(nullif(btrim(v_existing.priority), ''), 'NORMALE'),
    'intervenant_id', v_existing.intervenant_id,
    'levee_at', v_existing.levee_at,
    'created_at', v_existing.created_at,
    'updated_at', v_existing.updated_at
  );
end;
$$;

revoke all on function public.intervenant_reserve_mark_lifted(text, uuid) from public;
grant execute on function public.intervenant_reserve_mark_lifted(text, uuid) to anon, authenticated;
