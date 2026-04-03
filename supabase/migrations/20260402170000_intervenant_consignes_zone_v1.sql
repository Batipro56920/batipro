drop function if exists public.intervenant_consigne_list(text, uuid);
create or replace function public.intervenant_consigne_list(
  p_token text,
  p_chantier_id uuid default null
)
returns table (
  id uuid,
  chantier_id uuid,
  chantier_nom text,
  title text,
  description text,
  priority text,
  date_debut date,
  date_fin date,
  task_id uuid,
  task_titre text,
  zone_id uuid,
  zone_nom text,
  applies_to_all boolean,
  is_read boolean,
  read_at timestamptz,
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
    c.id,
    c.chantier_id,
    ch.nom as chantier_nom,
    c.title,
    c.description,
    c.priority,
    c.date_debut,
    c.date_fin,
    c.task_id,
    t.titre as task_titre,
    c.zone_id,
    z.nom as zone_nom,
    c.applies_to_all,
    (r.read_at is not null) as is_read,
    r.read_at,
    c.created_at,
    c.updated_at
  from public.chantier_consignes c
  join public.chantiers ch on ch.id = c.chantier_id
  left join public.chantier_tasks t on t.id = c.task_id
  left join public.chantier_zones z on z.id = c.zone_id
  left join public.chantier_consigne_reads r
    on r.consigne_id = c.id
   and r.intervenant_id = v_ctx.intervenant_id
  where (
      (p_chantier_id is null and c.chantier_id = any(v_ctx.chantier_ids))
      or (p_chantier_id is not null and c.chantier_id = p_chantier_id)
    )
    and (
      c.applies_to_all
      or exists (
        select 1
        from public.chantier_consigne_intervenants ci
        where ci.consigne_id = c.id
          and ci.intervenant_id = v_ctx.intervenant_id
      )
    )
  order by c.date_debut desc, c.created_at desc;
end;
$$;

revoke all on function public.intervenant_consigne_list(text, uuid) from public;
grant execute on function public.intervenant_consigne_list(text, uuid) to anon, authenticated;
