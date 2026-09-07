-- L'ouvrier ne recevait que les matériaux cochés "matériau principal", or ce drapeau
-- sert au suivi de perte, pas à la préparation de journée : une tâche dont aucun
-- matériau n'est coché affichait une liste vide alors que des matériaux étaient bien
-- configurés. Pour qu'il n'oublie rien, on renvoie tous les matériaux de la tâche et
-- on expose le drapeau, la saisie de consommation restant réservée aux principaux.

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
  expected_quantity numeric,
  is_main_material boolean
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
    round(t.quantite * r.ratio_quantity * (1 + coalesce(r.loss_percent, 0) / 100), 2) as expected_quantity,
    r.is_main_material
  from public.task_template_material_ratios r
  join public.chantier_tasks t on t.task_template_id = r.task_template_id
  where t.id = p_task_id
    and t.chantier_id = p_chantier_id
  order by r.is_main_material desc, r.sort_order, r.material_name;
end;
$$;

revoke all on function public.intervenant_task_main_materials(text, uuid, uuid) from public;
grant execute on function public.intervenant_task_main_materials(text, uuid, uuid) to anon, authenticated;
