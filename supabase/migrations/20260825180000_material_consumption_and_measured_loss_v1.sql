-- Perte matière réelle : saisie terrain (consommation réelle du matériau
-- principal d'une tâche), mesure agrégée sur tous les chantiers, et un
-- historique de prix sur task_templates pour appliquer cette mesure au prix
-- de façon revue (jamais automatique).

alter table public.task_template_material_ratios
  add column if not exists is_main_material boolean not null default false;

comment on column public.task_template_material_ratios.is_main_material is
  'Matériau considéré comme le principal poste de coût de cette tâche (ex. plaques de placo, pas les vis) — seuls ceux-ci sont suivis en consommation réelle côté terrain.';

alter table public.task_templates
  add column if not exists price_history jsonb not null default '[]'::jsonb;

comment on column public.task_templates.price_history is
  'Historique des changements de cout_reference_unitaire_ht (ancien prix, nouveau prix, date, source) — même principe que product_catalog_items.priceHistory, absent ici jusqu''à présent.';

create table if not exists public.chantier_task_material_consumptions (
  id uuid primary key default gen_random_uuid(),
  chantier_task_id uuid not null references public.chantier_tasks(id) on delete cascade,
  material_ratio_id uuid not null references public.task_template_material_ratios(id) on delete cascade,
  intervenant_id uuid not null references public.intervenants(id) on delete cascade,
  quantite_consommee numeric not null,
  work_date date not null default current_date,
  created_at timestamptz not null default now(),
  constraint chantier_task_material_consumptions_qty_chk check (quantite_consommee > 0)
);

create index if not exists chantier_task_material_consumptions_task_idx
  on public.chantier_task_material_consumptions(chantier_task_id);
create index if not exists chantier_task_material_consumptions_ratio_idx
  on public.chantier_task_material_consumptions(material_ratio_id);
create index if not exists chantier_task_material_consumptions_intervenant_idx
  on public.chantier_task_material_consumptions(intervenant_id, work_date desc);

alter table public.chantier_task_material_consumptions enable row level security;

drop policy if exists chantier_task_material_consumptions_backoffice_all on public.chantier_task_material_consumptions;
create policy chantier_task_material_consumptions_backoffice_all
  on public.chantier_task_material_consumptions
  for all
  to authenticated
  using (public.is_backoffice())
  with check (public.is_backoffice());

-- RPC de saisie côté portail intervenant (token brut ou vraie session), calquée
-- exactement sur intervenant_time_create (même resolver d'accès, même forme).
create or replace function public.intervenant_material_consumption_create(
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
  v_task_id uuid;
  v_material_ratio_id uuid;
  v_intervenant_id uuid;
  v_quantity numeric;
  v_work_date date;
  v_id uuid;
begin
  v_chantier_id := nullif(btrim(coalesce(p_payload ->> 'chantier_id', '')), '')::uuid;
  v_task_id := nullif(btrim(coalesce(p_payload ->> 'task_id', '')), '')::uuid;
  v_material_ratio_id := nullif(btrim(coalesce(p_payload ->> 'material_ratio_id', '')), '')::uuid;
  v_quantity := nullif(btrim(coalesce(p_payload ->> 'quantite_consommee', p_payload ->> 'quantity', '')), '')::numeric;
  v_work_date := coalesce(nullif(btrim(coalesce(p_payload ->> 'work_date', '')), '')::date, current_date);

  if v_chantier_id is null then raise exception 'chantier_id_required'; end if;
  if v_task_id is null then raise exception 'task_id_required'; end if;
  if v_material_ratio_id is null then raise exception 'material_ratio_id_required'; end if;
  if v_quantity is null or v_quantity <= 0 then raise exception 'invalid_quantite_consommee'; end if;

  v_intervenant_id := public._intervenant_assert_chantier_access(p_token, v_chantier_id);
  if v_intervenant_id is null then
    raise exception 'intervenant_required';
  end if;

  if not exists (
    select 1
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
      )
  ) then
    raise exception 'forbidden_task_scope';
  end if;

  if not exists (
    select 1
    from public.task_template_material_ratios r
    join public.chantier_tasks t on t.task_template_id = r.task_template_id
    where r.id = v_material_ratio_id
      and t.id = v_task_id
      and r.is_main_material = true
  ) then
    raise exception 'invalid_material_ratio';
  end if;

  insert into public.chantier_task_material_consumptions (
    chantier_task_id, material_ratio_id, intervenant_id, quantite_consommee, work_date
  ) values (
    v_task_id, v_material_ratio_id, v_intervenant_id, v_quantity, v_work_date
  )
  returning id into v_id;

  return jsonb_build_object(
    'id', v_id,
    'chantier_id', v_chantier_id,
    'task_id', v_task_id,
    'material_ratio_id', v_material_ratio_id,
    'quantite_consommee', v_quantity,
    'work_date', v_work_date
  );
end;
$$;

revoke all on function public.intervenant_material_consumption_create(text, jsonb) from public;
grant execute on function public.intervenant_material_consumption_create(text, jsonb) to anon, authenticated;

-- RPC de lecture : les matériaux principaux disponibles pour une tâche donnée
-- (pour savoir côté portail si un champ de saisie doit apparaître, et avec
-- quelle unité/quel libellé).
create or replace function public.intervenant_task_main_materials(
  p_token text,
  p_chantier_id uuid,
  p_task_id uuid
)
returns table (
  material_ratio_id uuid,
  material_name text,
  ratio_unit text
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
  select r.id, r.material_name, r.ratio_unit
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

-- Perte mesurée agrégée par modèle de tâche + matériau principal, sur
-- l'ensemble des chantiers (pas chantier par chantier). security_invoker
-- pour que la RLS des tables sous-jacentes (task_template_material_ratios,
-- chantier_tasks, chantier_task_material_consumptions) s'applique selon
-- l'utilisateur qui interroge la vue, pas selon son propriétaire.
create or replace view public.task_template_material_measured_loss
with (security_invoker = true) as
with consumption_per_task as (
  select chantier_task_id, material_ratio_id, sum(quantite_consommee) as consumed_quantity
  from public.chantier_task_material_consumptions
  group by chantier_task_id, material_ratio_id
)
select
  r.id as material_ratio_id,
  r.task_template_id,
  r.material_name,
  r.ratio_quantity,
  r.ratio_unit,
  r.loss_percent as planned_loss_percent,
  r.purchase_price_ht,
  count(distinct t.chantier_id) as chantiers_count,
  sum(t.quantite * r.ratio_quantity) as theoretical_quantity,
  sum(cpt.consumed_quantity) as actual_quantity,
  case
    when sum(t.quantite * r.ratio_quantity) > 0
      then round(((sum(cpt.consumed_quantity) - sum(t.quantite * r.ratio_quantity)) / sum(t.quantite * r.ratio_quantity)) * 100, 1)
    else null
  end as measured_loss_percent
from public.task_template_material_ratios r
join public.chantier_tasks t on t.task_template_id = r.task_template_id
join consumption_per_task cpt on cpt.chantier_task_id = t.id and cpt.material_ratio_id = r.id
where r.is_main_material = true
group by r.id, r.task_template_id, r.material_name, r.ratio_quantity, r.ratio_unit, r.loss_percent, r.purchase_price_ht;

revoke all on public.task_template_material_measured_loss from public, anon;
grant select on public.task_template_material_measured_loss to authenticated;
