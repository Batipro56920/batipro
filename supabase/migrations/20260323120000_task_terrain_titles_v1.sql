alter table if exists public.chantier_tasks
  add column if not exists libelle_devis_original text;

alter table if exists public.chantier_tasks
  add column if not exists titre_terrain text;

update public.chantier_tasks t
set
  titre_terrain = coalesce(nullif(btrim(t.titre_terrain), ''), nullif(btrim(t.titre), ''), 'Sans titre'),
  libelle_devis_original = coalesce(
    nullif(btrim(t.libelle_devis_original), ''),
    nullif(btrim(dl.designation), ''),
    nullif(btrim(t.titre), ''),
    'Sans titre'
  )
from public.devis_lignes dl
where dl.id = t.devis_ligne_id
  and (
    t.titre_terrain is null
    or btrim(t.titre_terrain) = ''
    or t.libelle_devis_original is null
    or btrim(t.libelle_devis_original) = ''
  );

update public.chantier_tasks
set
  titre_terrain = coalesce(nullif(btrim(titre_terrain), ''), nullif(btrim(titre), ''), 'Sans titre'),
  libelle_devis_original = coalesce(
    nullif(btrim(libelle_devis_original), ''),
    nullif(btrim(titre), ''),
    coalesce(nullif(btrim(titre_terrain), ''), nullif(btrim(titre), ''), 'Sans titre')
  )
where
  titre_terrain is null
  or btrim(titre_terrain) = ''
  or libelle_devis_original is null
  or btrim(libelle_devis_original) = '';

drop function if exists public._chantier_task_display_title(public.chantier_tasks);
create or replace function public._chantier_task_display_title(p_task public.chantier_tasks)
returns text
language sql
stable
set search_path = public
as $$
  select coalesce(
    nullif(btrim(p_task.titre_terrain), ''),
    nullif(btrim(p_task.titre), ''),
    'Sans titre'
  );
$$;

revoke all on function public._chantier_task_display_title(public.chantier_tasks) from public;

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
    public._chantier_task_display_title(t) as titre,
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
  order by coalesce(t.order_index, 0), coalesce(t.created_at, now()), public._chantier_task_display_title(t);
end;
$$;

revoke all on function public.intervenant_get_tasks(text, uuid) from public;
grant execute on function public.intervenant_get_tasks(text, uuid) to anon, authenticated;

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
    case when t.id is null then null else public._chantier_task_display_title(t) end as task_titre,
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

drop function if exists public.intervenant_materiel_create(text, jsonb);
create or replace function public.intervenant_materiel_create(
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
  v_intervenant_id uuid;
  v_task_id uuid;
  v_titre text;
  v_quantite numeric;
  v_unite text;
  v_commentaire text;
  v_date_souhaitee date;
  v_task_titre text;
  v_id uuid;
begin
  v_chantier_id := nullif(btrim(coalesce(p_payload ->> 'chantier_id', '')), '')::uuid;
  if v_chantier_id is null then
    raise exception 'chantier_id_required';
  end if;

  v_intervenant_id := public._intervenant_assert_chantier_access(p_token, v_chantier_id);
  if v_intervenant_id is null then
    raise exception 'intervenant_required';
  end if;

  v_task_id := nullif(btrim(coalesce(p_payload ->> 'task_id', '')), '')::uuid;

  if v_task_id is not null then
    select public._chantier_task_display_title(t)
    into v_task_titre
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
      );

    if v_task_titre is null then
      raise exception 'forbidden_task_scope';
    end if;
  end if;

  v_titre := nullif(btrim(coalesce(p_payload ->> 'titre', p_payload ->> 'title')), '');
  if v_titre is null then
    raise exception 'titre_required';
  end if;

  v_quantite := nullif(btrim(coalesce(p_payload ->> 'quantite', '')), '')::numeric;
  v_unite := nullif(btrim(coalesce(p_payload ->> 'unite', '')), '');
  v_commentaire := nullif(btrim(coalesce(p_payload ->> 'commentaire', p_payload ->> 'comment')), '');
  v_date_souhaitee := nullif(btrim(coalesce(p_payload ->> 'date_souhaitee', '')), '')::date;

  insert into public.materiel_demandes (
    chantier_id,
    intervenant_id,
    task_id,
    titre,
    designation,
    quantite,
    unite,
    commentaire,
    remarques,
    date_souhaitee,
    date_besoin,
    statut,
    status
  ) values (
    v_chantier_id,
    v_intervenant_id,
    v_task_id,
    v_titre,
    v_titre,
    coalesce(v_quantite, 1),
    v_unite,
    v_commentaire,
    v_commentaire,
    v_date_souhaitee,
    v_date_souhaitee,
    'en_attente',
    'A_COMMANDER'
  )
  returning id into v_id;

  if v_task_titre is null and v_task_id is not null then
    select public._chantier_task_display_title(t)
    into v_task_titre
    from public.chantier_tasks t
    where t.id = v_task_id;
  end if;

  return jsonb_build_object(
    'id', v_id,
    'chantier_id', v_chantier_id,
    'intervenant_id', v_intervenant_id,
    'task_id', v_task_id,
    'task_titre', v_task_titre,
    'titre', v_titre,
    'quantite', coalesce(v_quantite, 1),
    'unite', v_unite,
    'commentaire', v_commentaire,
    'date_souhaitee', v_date_souhaitee,
    'statut', 'en_attente'
  );
end;
$$;

revoke all on function public.intervenant_materiel_create(text, jsonb) from public;
grant execute on function public.intervenant_materiel_create(text, jsonb) to anon, authenticated;

drop function if exists public.intervenant_materiel_list(text, uuid);
create or replace function public.intervenant_materiel_list(
  p_token text,
  p_chantier_id uuid
)
returns table (
  id uuid,
  chantier_id uuid,
  intervenant_id uuid,
  task_id uuid,
  task_titre text,
  titre text,
  quantite numeric,
  unite text,
  commentaire text,
  date_souhaitee date,
  statut text,
  admin_commentaire text,
  validated_at timestamptz,
  validated_by uuid,
  created_at timestamptz,
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
    md.id,
    md.chantier_id,
    md.intervenant_id,
    md.task_id,
    case when t.id is null then null else public._chantier_task_display_title(t) end as task_titre,
    coalesce(nullif(btrim(md.titre), ''), nullif(btrim(md.designation), ''), 'Demande materiel') as titre,
    md.quantite,
    md.unite,
    coalesce(md.commentaire, md.remarques) as commentaire,
    coalesce(md.date_souhaitee, md.date_besoin, md.date_livraison) as date_souhaitee,
    public._materiel_normalize_statut(md.statut, md.status) as statut,
    md.admin_commentaire,
    md.validated_at,
    md.validated_by,
    md.created_at,
    md.updated_at
  from public.materiel_demandes md
  left join public.chantier_tasks t
    on t.id = md.task_id
  where md.chantier_id = p_chantier_id
    and (v_intervenant_id is null or md.intervenant_id = v_intervenant_id)
  order by md.created_at desc;
end;
$$;

revoke all on function public.intervenant_materiel_list(text, uuid) from public;
grant execute on function public.intervenant_materiel_list(text, uuid) to anon, authenticated;

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
    case when t.id is null then null else public._chantier_task_display_title(t) end as task_titre,
    c.applies_to_all,
    (r.read_at is not null) as is_read,
    r.read_at,
    c.created_at,
    c.updated_at
  from public.chantier_consignes c
  join public.chantiers ch on ch.id = c.chantier_id
  left join public.chantier_tasks t on t.id = c.task_id
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
