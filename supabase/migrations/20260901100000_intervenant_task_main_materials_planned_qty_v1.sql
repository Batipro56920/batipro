-- Onglet "Matin" du portail ouvrier : pour préparer sa journée, l'intervenant a
-- besoin de connaître la quantité de matériau principal *prévue* pour la tâche,
-- pas seulement son nom et son unité (déjà exposés). On expose ratio_quantity/
-- source_unit/loss_percent, et une quantité prévue déjà multipliée par
-- chantier_tasks.quantite (même calcul que task_template_material_measured_loss,
-- vue dans 20260825180000_material_consumption_and_measured_loss_v1.sql).

drop function if exists public.intervenant_task_main_materials(text, uuid, uuid);
create function public.intervenant_task_main_materials(
  p_token text,
  p_chantier_id uuid,
  p_task_id uuid
)
returns table (
  material_ratio_id uuid,
  material_name text,
  ratio_unit text,
  ratio_quantity numeric,
  source_unit text,
  loss_percent numeric,
  expected_quantity numeric
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
    r.id,
    r.material_name,
    r.ratio_unit,
    r.ratio_quantity,
    r.source_unit,
    r.loss_percent,
    round(t.quantite * r.ratio_quantity * (1 + coalesce(r.loss_percent, 0) / 100), 2) as expected_quantity
  from public.task_template_material_ratios r
  join public.chantier_tasks t on t.task_template_id = r.task_template_id
  where t.id = p_task_id
    and t.chantier_id = p_chantier_id
    and r.is_main_material = true
  order by r.sort_order, r.material_name;
end;
$$;

revoke all on function public.intervenant_task_main_materials(text, uuid, uuid) from public;
grant execute on function public.intervenant_task_main_materials(text, uuid, uuid) to anon, authenticated;
