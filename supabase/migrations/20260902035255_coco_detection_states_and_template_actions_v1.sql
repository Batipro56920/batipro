-- États de revue des détections COCO. Une détection supprimée ici ne supprime
-- jamais le message ou le retour terrain d'origine.
create table if not exists public.coco_improvement_signal_states (
  signal_key text primary key,
  status text not null default 'active' check (status in ('active', 'pending', 'dismissed', 'applied')),
  updated_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  updated_at timestamptz not null default now()
);

alter table public.coco_improvement_signal_states enable row level security;

drop policy if exists coco_improvement_signal_states_admin_select on public.coco_improvement_signal_states;
create policy coco_improvement_signal_states_admin_select
  on public.coco_improvement_signal_states for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ADMIN'));

drop policy if exists coco_improvement_signal_states_admin_insert on public.coco_improvement_signal_states;
create policy coco_improvement_signal_states_admin_insert
  on public.coco_improvement_signal_states for insert to authenticated
  with check (
    updated_by = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ADMIN')
  );

drop policy if exists coco_improvement_signal_states_admin_update on public.coco_improvement_signal_states;
create policy coco_improvement_signal_states_admin_update
  on public.coco_improvement_signal_states for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ADMIN'))
  with check (
    updated_by = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ADMIN')
  );

grant select, insert, update on table public.coco_improvement_signal_states to authenticated;

alter table public.coco_improvement_actions
  drop constraint if exists coco_improvement_actions_action_type_check;
alter table public.coco_improvement_actions
  add constraint coco_improvement_actions_action_type_check check (
    action_type in (
      'create_purchase_request',
      'publish_decision',
      'create_task_template_with_equipment',
      'add_equipment_to_templates',
      'add_client_note'
    )
  );

create or replace function public.apply_coco_improvement_action(
  p_signal_id text,
  p_source_type text,
  p_source_id uuid,
  p_chantier_id uuid,
  p_task_id uuid,
  p_decision_text text,
  p_action_type text,
  p_action_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_profile public.profiles%rowtype;
  v_task public.chantier_tasks%rowtype;
  v_chantier public.chantiers%rowtype;
  v_template_id uuid;
  v_template_ids uuid[] := '{}'::uuid[];
  v_client_id uuid;
  v_purchase_id uuid;
  v_post_id uuid;
  v_equipment text;
  v_title text;
  v_confirmation text;
  v_client_note text;
  v_result jsonb;
begin
  select * into v_profile from public.profiles where id = auth.uid();
  if v_profile.id is null or v_profile.role <> 'ADMIN' then
    raise exception 'forbidden_coco_action';
  end if;
  if nullif(btrim(p_signal_id), '') is null or nullif(btrim(p_decision_text), '') is null then
    raise exception 'invalid_coco_action';
  end if;
  if p_source_type not in ('chantier_feed', 'terrain_feedback') then
    raise exception 'invalid_coco_source';
  end if;
  if p_action_type not in (
    'create_purchase_request', 'publish_decision',
    'create_task_template_with_equipment', 'add_equipment_to_templates', 'add_client_note'
  ) then
    raise exception 'invalid_coco_action_type';
  end if;
  if exists (select 1 from public.coco_improvement_actions where signal_id = p_signal_id) then
    raise exception 'coco_action_already_applied';
  end if;

  select * into v_chantier from public.chantiers where id = p_chantier_id;
  if v_chantier.id is null then raise exception 'chantier_not_found'; end if;

  if p_task_id is not null then
    select * into v_task from public.chantier_tasks where id = p_task_id and chantier_id = p_chantier_id;
    if v_task.id is null then raise exception 'task_not_in_chantier'; end if;
  end if;

  v_equipment := nullif(btrim(p_action_payload ->> 'equipmentName'), '');

  if p_action_type = 'create_task_template_with_equipment' then
    if v_task.id is null or v_equipment is null then raise exception 'task_and_equipment_required'; end if;
    if v_task.task_template_id is not null then
      v_template_id := v_task.task_template_id;
    else
      insert into public.task_templates (
        titre, lot, unite, quantite_defaut, temps_prevu_par_unite_h,
        remarques, description_technique, caracteristiques
      ) values (
        coalesce(nullif(btrim(v_task.task_template_label), ''), nullif(btrim(v_task.titre), ''), 'Tâche chantier'),
        coalesce(nullif(btrim(v_task.lot), ''), 'Non classé'),
        nullif(btrim(v_task.unite), ''),
        v_task.quantite,
        case when coalesce(v_task.quantite, 0) > 0 and v_task.temps_prevu_h is not null
          then v_task.temps_prevu_h / v_task.quantite else null end,
        'Template créé par COCO après validation d’un retour terrain.',
        v_task.description_technique,
        coalesce(v_task.caracteristiques, '[]'::jsonb)
      ) returning id into v_template_id;

      update public.chantier_tasks
      set task_template_id = v_template_id,
          task_template_label = coalesce(nullif(btrim(task_template_label), ''), titre)
      where id = v_task.id;
    end if;
    v_template_ids := array[v_template_id];
  elsif p_action_type = 'add_equipment_to_templates' then
    select coalesce(array_agg(value::uuid), '{}'::uuid[])
    into v_template_ids
    from jsonb_array_elements_text(coalesce(p_action_payload -> 'templateIds', '[]'::jsonb)) value
    where value ~ '^[0-9a-fA-F-]{36}$';
    if v_equipment is null or cardinality(v_template_ids) = 0 then
      raise exception 'templates_and_equipment_required';
    end if;
    if exists (
      select 1 from unnest(v_template_ids) id
      where not exists (select 1 from public.task_templates tt where tt.id = id)
    ) then raise exception 'template_not_found'; end if;
  end if;

  if p_action_type in ('create_task_template_with_equipment', 'add_equipment_to_templates') then
    insert into public.task_template_equipment_items (
      task_template_id, equipment_name, is_required, default_quantity, unit, notes, sort_order
    )
    select
      target.id,
      v_equipment,
      true,
      1,
      'u',
      'Besoin détecté par COCO puis validé depuis un retour terrain.',
      coalesce((select max(e.sort_order) + 1 from public.task_template_equipment_items e where e.task_template_id = target.id), 0)
    from unnest(v_template_ids) target(id)
    where not exists (
      select 1 from public.task_template_equipment_items existing
      where existing.task_template_id = target.id
        and lower(btrim(existing.equipment_name)) = lower(btrim(v_equipment))
    );
  elsif p_action_type = 'add_client_note' then
    v_client_id := nullif(p_action_payload ->> 'clientId', '')::uuid;
    if v_client_id is null or v_chantier.crm_client_id is distinct from v_client_id then
      raise exception 'client_not_linked_to_chantier';
    end if;
    v_client_note := coalesce(nullif(btrim(p_action_payload ->> 'clientNote'), ''), btrim(p_decision_text));
    update public.crm_clients
    set notes = concat_ws(E'\n', nullif(btrim(notes), ''),
      to_char(current_date, 'DD/MM/YYYY') || ' — COCO · Pense-bête : ' || v_client_note),
      updated_at = now()
    where id = v_client_id;
    if not found then raise exception 'client_not_found'; end if;
  elsif p_action_type = 'create_purchase_request' then
    v_title := coalesce(nullif(btrim(p_action_payload ->> 'title'), ''), left(btrim(p_decision_text), 180));
    insert into public.chantier_purchase_requests (
      chantier_id, task_id, supplier_name, titre, quantite, unite,
      statut_commande, livraison_prevue_le, recu, commentaire, created_by
    ) values (
      p_chantier_id, p_task_id, nullif(btrim(p_action_payload ->> 'supplierName'), ''), v_title,
      case when (p_action_payload ->> 'quantity') ~ '^[0-9]+([.][0-9]+)?$'
        then (p_action_payload ->> 'quantity')::numeric else 1 end,
      nullif(btrim(p_action_payload ->> 'unit'), ''), 'a_commander',
      case when (p_action_payload ->> 'dueDate') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
        then (p_action_payload ->> 'dueDate')::date else null end,
      false, 'Créé par COCO après validation : ' || btrim(p_decision_text), auth.uid()
    ) returning id into v_purchase_id;
  end if;

  v_confirmation := coalesce(
    nullif(btrim(p_action_payload ->> 'confirmationMessage'), ''),
    '✅ Amélioration COCO appliquée : ' || btrim(p_decision_text)
  );
  insert into public.chantier_feed_posts (
    chantier_id, author_id, author_name, author_role, body, visibility, parent_post_id
  ) values (
    p_chantier_id, auth.uid(), coalesce(v_profile.display_name, 'COCO'), v_profile.role,
    left(v_confirmation, 5000), 'equipe',
    case when p_source_type = 'chantier_feed' then p_source_id else null end
  ) returning id into v_post_id;

  v_result := jsonb_strip_nulls(jsonb_build_object(
    'templateIds', to_jsonb(v_template_ids),
    'clientId', v_client_id,
    'purchaseRequestId', v_purchase_id,
    'feedPostId', v_post_id
  ));

  insert into public.coco_improvement_actions (
    signal_id, source_type, source_id, chantier_id, task_id,
    decision_text, action_type, action_payload, result, created_by
  ) values (
    p_signal_id, p_source_type, p_source_id, p_chantier_id, p_task_id,
    btrim(p_decision_text), p_action_type, coalesce(p_action_payload, '{}'::jsonb), v_result, auth.uid()
  );

  insert into public.coco_improvement_signal_states (signal_key, status, updated_by, updated_at)
  values (p_signal_id, 'applied', auth.uid(), now())
  on conflict (signal_key) do update
    set status = 'applied', updated_by = auth.uid(), updated_at = now();

  return v_result;
end;
$$;

revoke all on function public.apply_coco_improvement_action(text, text, uuid, uuid, uuid, text, text, jsonb) from public;
grant execute on function public.apply_coco_improvement_action(text, text, uuid, uuid, uuid, text, text, jsonb) to authenticated;
