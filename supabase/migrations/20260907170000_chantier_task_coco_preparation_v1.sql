-- La préparation Coco (listes matériaux/matériel/EPI + mode opératoire) n'existait
-- que sur le modèle de tâche. Une tâche de chantier créée sans modèle n'avait donc
-- nulle part où la stocker, et l'onglet Technique retombait sur des champs texte
-- libres (description technique, caractéristiques, contraintes...) faisant doublon.

alter table public.chantier_tasks
  add column if not exists coco_preparation jsonb;

-- Le portail ouvrier doit lire la préparation de la tâche si elle existe, sinon
-- celle du modèle : une tâche hors modèle doit rester exploitable sur le terrain.
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
  v_preparation jsonb;
begin
  v_intervenant_id := public._intervenant_assert_chantier_access(p_token, p_chantier_id);
  if v_intervenant_id is null then
    raise exception 'intervenant_required';
  end if;

  select coalesce(
           nullif(t.coco_preparation, '{}'::jsonb),
           nullif(tpl.coco_preparation, '{}'::jsonb),
           '{}'::jsonb
         )
    into v_preparation
  from public.chantier_tasks t
  left join public.task_templates tpl on tpl.id = t.task_template_id
  where t.id = p_task_id
    and t.chantier_id = p_chantier_id;

  if v_preparation is null then
    return;
  end if;

  return query
  select
    public._coco_preparation_list(v_preparation, 'procedure'),
    public._coco_preparation_list(v_preparation, 'ppe'),
    public._coco_preparation_list(v_preparation, 'safetyPoints'),
    public._coco_preparation_list(v_preparation, 'controls'),
    public._coco_preparation_list(v_preparation, 'errorsToAvoid');
end;
$$;

revoke all on function public.intervenant_task_briefing(text, uuid, uuid) from public;
grant execute on function public.intervenant_task_briefing(text, uuid, uuid) to anon, authenticated;
