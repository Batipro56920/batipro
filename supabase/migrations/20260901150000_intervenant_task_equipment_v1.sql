-- Onglet "Matin" du portail ouvrier : jusqu'ici seuls les matériaux prévus
-- étaient affichés pour préparer la journée, pas le matériel/outillage
-- (task_template_equipment_items existe depuis la bibliothèque de templates
-- mais n'était jamais exposé côté portail intervenant). On expose la liste
-- du matériel prévu pour une tâche, même principe que
-- intervenant_task_main_materials.

drop function if exists public.intervenant_task_equipment(text, uuid, uuid);
create function public.intervenant_task_equipment(
  p_token text,
  p_chantier_id uuid,
  p_task_id uuid
)
returns table (
  equipment_item_id uuid,
  equipment_name text,
  is_required boolean,
  default_quantity numeric,
  unit text,
  notes text
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
    e.id,
    e.equipment_name,
    e.is_required,
    e.default_quantity,
    e.unit,
    e.notes
  from public.task_template_equipment_items e
  join public.chantier_tasks t on t.task_template_id = e.task_template_id
  where t.id = p_task_id
    and t.chantier_id = p_chantier_id
  order by e.sort_order, e.equipment_name;
end;
$$;

revoke all on function public.intervenant_task_equipment(text, uuid, uuid) from public;
grant execute on function public.intervenant_task_equipment(text, uuid, uuid) to anon, authenticated;
