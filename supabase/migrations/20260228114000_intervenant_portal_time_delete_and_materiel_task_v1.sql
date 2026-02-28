-- Intervenant portal: allow deleting own time entries and link materiel requests to tasks.

drop function if exists public.intervenant_time_delete(text, uuid);
create or replace function public.intervenant_time_delete(
  p_token text,
  p_time_entry_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_entry record;
  v_intervenant_id uuid;
begin
  if p_time_entry_id is null then
    raise exception 'time_entry_id_required';
  end if;

  select
    te.id,
    te.chantier_id,
    te.task_id,
    te.intervenant_id
  into v_entry
  from public.chantier_time_entries te
  where te.id = p_time_entry_id;

  if not found then
    raise exception 'time_entry_not_found';
  end if;

  v_intervenant_id := public._intervenant_assert_chantier_access(p_token, v_entry.chantier_id);
  if v_intervenant_id is null then
    raise exception 'intervenant_required';
  end if;

  if v_entry.intervenant_id is distinct from v_intervenant_id then
    raise exception 'forbidden_time_scope';
  end if;

  delete from public.chantier_time_entries
  where id = p_time_entry_id;

  perform public.recompute_task_logged_hours(v_entry.task_id);
end;
$$;

revoke all on function public.intervenant_time_delete(text, uuid) from public;
grant execute on function public.intervenant_time_delete(text, uuid) to anon, authenticated;

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
    select t.titre
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
    select t.titre into v_task_titre from public.chantier_tasks t where t.id = v_task_id;
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
    t.titre as task_titre,
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

drop function if exists public.admin_materiel_list(uuid);
create or replace function public.admin_materiel_list(p_chantier_id uuid)
returns table (
  id uuid,
  chantier_id uuid,
  intervenant_id uuid,
  task_id uuid,
  task_titre text,
  intervenant_nom text,
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
begin
  perform public._assert_admin_authenticated();

  if p_chantier_id is null then
    raise exception 'chantier_id_required';
  end if;

  return query
  select
    md.id,
    md.chantier_id,
    md.intervenant_id,
    md.task_id,
    t.titre as task_titre,
    i.nom as intervenant_nom,
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
  left join public.intervenants i
    on i.id = md.intervenant_id
  where md.chantier_id = p_chantier_id
  order by md.created_at desc;
end;
$$;

revoke all on function public.admin_materiel_list(uuid) from public;
grant execute on function public.admin_materiel_list(uuid) to authenticated;
