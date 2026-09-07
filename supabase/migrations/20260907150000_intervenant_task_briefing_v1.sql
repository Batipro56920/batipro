-- L'ouvrier recevait déjà les matériaux et le matériel prévus, mais jamais le mode
-- opératoire : il n'existait aucune surface "procédure" dans le portail terrain.
-- Coco produit désormais ces étapes (et les EPI) lors de la préparation du modèle de
-- tâche, stockées dans task_templates.coco_preparation. On les expose au portail sur
-- le même principe que intervenant_task_equipment.

-- Les blocs Coco sont stockés soit en tableau de chaînes, soit en tableau d'objets
-- {label/detail}. On normalise en tableau de texte pour le portail.
create or replace function public._coco_preparation_list(p_preparation jsonb, p_key text)
returns text[]
language sql
immutable
set search_path = public, pg_temp
as $$
  select coalesce(
    array(
      select value
      from (
        select case
          when jsonb_typeof(item) = 'string' then item #>> '{}'
          else coalesce(item ->> 'label', item ->> 'title', item ->> 'text', item ->> 'detail')
        end as value
        from jsonb_array_elements(
          case
            when jsonb_typeof(p_preparation -> p_key) = 'array' then p_preparation -> p_key
            else '[]'::jsonb
          end
        ) as item
      ) as normalized
      where coalesce(value, '') <> ''
    ),
    '{}'::text[]
  );
$$;

drop function if exists public.intervenant_task_briefing(text, uuid, uuid);
create function public.intervenant_task_briefing(
  p_token text,
  p_chantier_id uuid,
  p_task_id uuid
)
returns table (
  procedure_steps text[],
  ppe text[],
  safety_points text[],
  controls text[],
  errors_to_avoid text[]
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
    public._coco_preparation_list(tpl.coco_preparation, 'procedure'),
    public._coco_preparation_list(tpl.coco_preparation, 'ppe'),
    public._coco_preparation_list(tpl.coco_preparation, 'safetyPoints'),
    public._coco_preparation_list(tpl.coco_preparation, 'controls'),
    public._coco_preparation_list(tpl.coco_preparation, 'errorsToAvoid')
  from public.chantier_tasks t
  join public.task_templates tpl on tpl.id = t.task_template_id
  where t.id = p_task_id
    and t.chantier_id = p_chantier_id;
end;
$$;

revoke all on function public.intervenant_task_briefing(text, uuid, uuid) from public;
grant execute on function public.intervenant_task_briefing(text, uuid, uuid) to anon, authenticated;
