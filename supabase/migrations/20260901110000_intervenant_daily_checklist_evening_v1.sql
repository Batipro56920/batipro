-- Onglet "Soir" du portail ouvrier : checklist de fin de chantier (chantier
-- propre, matériel rangé, camion rangé), en plus de la checklist du matin
-- déjà existante (has_equipment/has_materials/has_information). Même ligne
-- par (intervenant, jour) que l'existant — pas besoin de notion matin/soir en
-- base, juste de nouvelles colonnes sur la même ligne.

alter table public.intervenant_daily_checklists
  add column if not exists site_propre boolean,
  add column if not exists materiel_range boolean,
  add column if not exists camion_range boolean;

drop function if exists public.intervenant_daily_checklist_get(text, date);
create or replace function public.intervenant_daily_checklist_get(
  p_token text,
  p_checklist_date date default current_date
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ctx record;
  v_row public.intervenant_daily_checklists%rowtype;
  v_checklist_date date;
begin
  select *
  into v_ctx
  from public._intervenant_token_context_v2(p_token)
  limit 1;

  if v_ctx.intervenant_id is null then
    raise exception 'intervenant_required';
  end if;

  v_checklist_date := coalesce(p_checklist_date, current_date);

  select *
  into v_row
  from public.intervenant_daily_checklists
  where intervenant_id = v_ctx.intervenant_id
    and checklist_date = v_checklist_date
  limit 1;

  return jsonb_build_object(
    'id', v_row.id,
    'intervenant_id', v_ctx.intervenant_id,
    'chantier_id', coalesce(v_row.chantier_id, v_ctx.default_chantier_id),
    'checklist_date', v_checklist_date,
    'photos_taken', v_row.photos_taken,
    'tasks_reported', v_row.tasks_reported,
    'time_logged', v_row.time_logged,
    'has_equipment', v_row.has_equipment,
    'has_materials', v_row.has_materials,
    'has_information', v_row.has_information,
    'site_propre', v_row.site_propre,
    'materiel_range', v_row.materiel_range,
    'camion_range', v_row.camion_range,
    'validated_at', v_row.validated_at,
    'created_at', v_row.created_at,
    'updated_at', v_row.updated_at
  );
end;
$$;

revoke all on function public.intervenant_daily_checklist_get(text, date) from public;
grant execute on function public.intervenant_daily_checklist_get(text, date) to anon, authenticated;

drop function if exists public.intervenant_daily_checklist_upsert(text, jsonb);
create or replace function public.intervenant_daily_checklist_upsert(
  p_token text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ctx record;
  v_existing public.intervenant_daily_checklists%rowtype;
  v_saved public.intervenant_daily_checklists%rowtype;
  v_checklist_date date;
  v_chantier_id uuid;
  v_validate boolean;
begin
  select *
  into v_ctx
  from public._intervenant_token_context_v2(p_token)
  limit 1;

  if v_ctx.intervenant_id is null then
    raise exception 'intervenant_required';
  end if;

  v_checklist_date := coalesce(
    nullif(btrim(coalesce(p_payload ->> 'checklist_date', '')), '')::date,
    current_date
  );

  v_chantier_id := nullif(btrim(coalesce(p_payload ->> 'chantier_id', '')), '')::uuid;
  if v_chantier_id is null then
    v_chantier_id := v_ctx.default_chantier_id;
  else
    perform public._intervenant_assert_chantier_access(p_token, v_chantier_id);
  end if;

  select *
  into v_existing
  from public.intervenant_daily_checklists
  where intervenant_id = v_ctx.intervenant_id
    and checklist_date = v_checklist_date
  limit 1;

  v_validate := coalesce((p_payload ->> 'validate')::boolean, false);

  insert into public.intervenant_daily_checklists (
    intervenant_id,
    chantier_id,
    checklist_date,
    photos_taken,
    tasks_reported,
    time_logged,
    has_equipment,
    has_materials,
    has_information,
    site_propre,
    materiel_range,
    camion_range,
    validated_at
  ) values (
    v_ctx.intervenant_id,
    v_chantier_id,
    v_checklist_date,
    coalesce((p_payload ->> 'photos_taken')::boolean, v_existing.photos_taken),
    coalesce((p_payload ->> 'tasks_reported')::boolean, v_existing.tasks_reported),
    coalesce((p_payload ->> 'time_logged')::boolean, v_existing.time_logged),
    coalesce((p_payload ->> 'has_equipment')::boolean, v_existing.has_equipment),
    coalesce((p_payload ->> 'has_materials')::boolean, v_existing.has_materials),
    coalesce((p_payload ->> 'has_information')::boolean, v_existing.has_information),
    coalesce((p_payload ->> 'site_propre')::boolean, v_existing.site_propre),
    coalesce((p_payload ->> 'materiel_range')::boolean, v_existing.materiel_range),
    coalesce((p_payload ->> 'camion_range')::boolean, v_existing.camion_range),
    case when v_validate then now() else v_existing.validated_at end
  )
  on conflict (intervenant_id, checklist_date)
  do update set
    chantier_id = excluded.chantier_id,
    photos_taken = excluded.photos_taken,
    tasks_reported = excluded.tasks_reported,
    time_logged = excluded.time_logged,
    has_equipment = excluded.has_equipment,
    has_materials = excluded.has_materials,
    has_information = excluded.has_information,
    site_propre = excluded.site_propre,
    materiel_range = excluded.materiel_range,
    camion_range = excluded.camion_range,
    validated_at = coalesce(excluded.validated_at, public.intervenant_daily_checklists.validated_at)
  returning * into v_saved;

  return jsonb_build_object(
    'id', v_saved.id,
    'intervenant_id', v_saved.intervenant_id,
    'chantier_id', v_saved.chantier_id,
    'checklist_date', v_saved.checklist_date,
    'photos_taken', v_saved.photos_taken,
    'tasks_reported', v_saved.tasks_reported,
    'time_logged', v_saved.time_logged,
    'has_equipment', v_saved.has_equipment,
    'has_materials', v_saved.has_materials,
    'has_information', v_saved.has_information,
    'site_propre', v_saved.site_propre,
    'materiel_range', v_saved.materiel_range,
    'camion_range', v_saved.camion_range,
    'validated_at', v_saved.validated_at,
    'created_at', v_saved.created_at,
    'updated_at', v_saved.updated_at
  );
end;
$$;

revoke all on function public.intervenant_daily_checklist_upsert(text, jsonb) from public;
grant execute on function public.intervenant_daily_checklist_upsert(text, jsonb) to anon, authenticated;
