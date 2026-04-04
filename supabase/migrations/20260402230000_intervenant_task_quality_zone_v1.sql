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
  zone_id uuid,
  zone_nom text,
  etape_metier text,
  quality_status text,
  admin_validation_status text,
  reprise_reason text,
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
    t.zone_id,
    z.nom as zone_nom,
    nullif(btrim(coalesce(t.etape_metier, '')), '') as etape_metier,
    coalesce(nullif(btrim(coalesce(t.quality_status, '')), ''), 'a_faire') as quality_status,
    coalesce(nullif(btrim(coalesce(t.admin_validation_status, '')), ''), 'non_verifie') as admin_validation_status,
    nullif(btrim(coalesce(t.reprise_reason, '')), '') as reprise_reason,
    t.updated_at
  from public.chantier_tasks t
  left join public.chantier_zones z on z.id = t.zone_id
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
