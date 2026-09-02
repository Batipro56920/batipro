-- Les décisions COCO restent sous contrôle humain : la fonction n'écrit
-- qu'après un clic explicite de l'administrateur et limite les actions possibles.
create table if not exists public.coco_improvement_actions (
  id uuid primary key default gen_random_uuid(),
  signal_id text not null unique,
  source_type text not null check (source_type in ('chantier_feed', 'terrain_feedback')),
  source_id uuid null,
  chantier_id uuid not null references public.chantiers(id) on delete cascade,
  task_id uuid null references public.chantier_tasks(id) on delete set null,
  decision_text text not null check (char_length(btrim(decision_text)) between 3 and 5000),
  action_type text not null check (action_type in ('create_purchase_request', 'publish_decision')),
  action_payload jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists coco_improvement_actions_chantier_created_idx
  on public.coco_improvement_actions (chantier_id, created_at desc);

alter table public.coco_improvement_actions enable row level security;

drop policy if exists coco_improvement_actions_admin_select on public.coco_improvement_actions;
create policy coco_improvement_actions_admin_select
  on public.coco_improvement_actions for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ADMIN'));

drop policy if exists coco_improvement_actions_admin_insert on public.coco_improvement_actions;
create policy coco_improvement_actions_admin_insert
  on public.coco_improvement_actions for insert to authenticated
  with check (
    created_by = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ADMIN')
  );

grant select, insert on table public.coco_improvement_actions to authenticated;

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
  v_purchase_id uuid;
  v_post_id uuid;
  v_title text;
  v_confirmation text;
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
  if p_action_type not in ('create_purchase_request', 'publish_decision') then
    raise exception 'invalid_coco_action_type';
  end if;
  if exists (select 1 from public.coco_improvement_actions where signal_id = p_signal_id) then
    raise exception 'coco_action_already_applied';
  end if;

  if p_action_type = 'create_purchase_request' then
    v_title := coalesce(nullif(btrim(p_action_payload ->> 'title'), ''), left(btrim(p_decision_text), 180));
    insert into public.chantier_purchase_requests (
      chantier_id, task_id, supplier_name, titre, quantite, unite,
      statut_commande, livraison_prevue_le, recu, commentaire, created_by
    ) values (
      p_chantier_id,
      p_task_id,
      nullif(btrim(p_action_payload ->> 'supplierName'), ''),
      v_title,
      case when (p_action_payload ->> 'quantity') ~ '^[0-9]+([.][0-9]+)?$'
        then (p_action_payload ->> 'quantity')::numeric else 1 end,
      nullif(btrim(p_action_payload ->> 'unit'), ''),
      'a_commander',
      case when (p_action_payload ->> 'dueDate') ~ '^\d{4}-\d{2}-\d{2}$'
        then (p_action_payload ->> 'dueDate')::date else null end,
      false,
      'Créé par COCO après validation : ' || btrim(p_decision_text),
      auth.uid()
    ) returning id into v_purchase_id;
  end if;

  v_confirmation := coalesce(
    nullif(btrim(p_action_payload ->> 'confirmationMessage'), ''),
    '✅ Décision appliquée par COCO : ' || btrim(p_decision_text)
  );
  if p_action_type = 'create_purchase_request' then
    v_confirmation := v_confirmation || E'\nDemande créée dans Achats et approvisionnements.';
  end if;

  insert into public.chantier_feed_posts (
    chantier_id, author_id, author_name, author_role, body, visibility, parent_post_id
  ) values (
    p_chantier_id,
    auth.uid(),
    coalesce(v_profile.display_name, 'COCO'),
    v_profile.role,
    left(v_confirmation, 5000),
    'equipe',
    case when p_source_type = 'chantier_feed' then p_source_id else null end
  ) returning id into v_post_id;

  v_result := jsonb_strip_nulls(jsonb_build_object(
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

  return v_result;
end;
$$;

revoke all on function public.apply_coco_improvement_action(text, text, uuid, uuid, uuid, text, text, jsonb) from public;
grant execute on function public.apply_coco_improvement_action(text, text, uuid, uuid, uuid, text, text, jsonb) to authenticated;
