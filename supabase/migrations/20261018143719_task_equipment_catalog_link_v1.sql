alter table public.task_template_equipment_items
  add column if not exists equipment_asset_id uuid null;

create index if not exists task_template_equipment_items_asset_idx
  on public.task_template_equipment_items(equipment_asset_id)
  where equipment_asset_id is not null;

create or replace function public.replace_task_template_preparation(
  p_task_template_id uuid,
  p_materials jsonb default '[]'::jsonb,
  p_equipment jsonb default '[]'::jsonb
)
returns void
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is null or not public.batipro_can_access_task_library_preparation() then
    raise exception 'Forbidden';
  end if;

  if p_task_template_id is null or not exists (select 1 from public.task_templates where id = p_task_template_id) then
    raise exception 'task_template introuvable';
  end if;

  delete from public.task_template_material_ratios where task_template_id = p_task_template_id;
  insert into public.task_template_material_ratios (
    task_template_id, product_id, material_name, source_unit, ratio_quantity, ratio_unit,
    loss_percent, supplier_id, purchase_price_ht, sale_price_ht, price_source,
    manual_override, is_main_material, notes, sort_order
  )
  select p_task_template_id, nullif(item->>'product_id', '')::uuid, trim(item->>'material_name'),
    trim(item->>'source_unit'), nullif(item->>'ratio_quantity', '')::numeric, trim(item->>'ratio_unit'),
    nullif(item->>'loss_percent', '')::numeric, nullif(item->>'supplier_id', '')::uuid,
    nullif(item->>'purchase_price_ht', '')::numeric, nullif(item->>'sale_price_ht', '')::numeric,
    nullif(trim(item->>'price_source'), ''), coalesce((item->>'manual_override')::boolean, false),
    coalesce((item->>'is_main_material')::boolean, false), nullif(trim(item->>'notes'), ''),
    coalesce((item->>'sort_order')::integer, 0)
  from jsonb_array_elements(coalesce(p_materials, '[]'::jsonb)) as item
  where nullif(trim(item->>'material_name'), '') is not null
    and nullif(trim(item->>'source_unit'), '') is not null
    and nullif(trim(item->>'ratio_unit'), '') is not null
    and nullif(item->>'ratio_quantity', '') is not null;

  delete from public.task_template_equipment_items where task_template_id = p_task_template_id;
  insert into public.task_template_equipment_items (
    task_template_id, equipment_asset_id, equipment_name, is_required,
    default_quantity, unit, notes, sort_order
  )
  select p_task_template_id, nullif(item->>'equipment_asset_id', '')::uuid,
    trim(item->>'equipment_name'), coalesce((item->>'is_required')::boolean, true),
    nullif(item->>'default_quantity', '')::numeric, nullif(trim(item->>'unit'), ''),
    nullif(trim(item->>'notes'), ''), coalesce((item->>'sort_order')::integer, 0)
  from jsonb_array_elements(coalesce(p_equipment, '[]'::jsonb)) as item
  where nullif(trim(item->>'equipment_name'), '') is not null;
end;
$$;

create or replace function public.copy_task_template_preparation(
  p_source_task_template_id uuid,
  p_target_task_template_id uuid
)
returns void
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is null or not public.batipro_can_access_task_library_preparation() then
    raise exception 'Forbidden';
  end if;

  if p_source_task_template_id is null or p_target_task_template_id is null then
    raise exception 'task_template_id manquant';
  end if;

  delete from public.task_template_material_ratios where task_template_id = p_target_task_template_id;
  insert into public.task_template_material_ratios (
    task_template_id, product_id, material_name, source_unit, ratio_quantity, ratio_unit,
    loss_percent, supplier_id, purchase_price_ht, sale_price_ht, price_source,
    manual_override, is_main_material, notes, sort_order
  )
  select p_target_task_template_id, product_id, material_name, source_unit, ratio_quantity, ratio_unit,
    loss_percent, supplier_id, purchase_price_ht, sale_price_ht, price_source,
    manual_override, is_main_material, notes, sort_order
  from public.task_template_material_ratios
  where task_template_id = p_source_task_template_id;

  delete from public.task_template_equipment_items where task_template_id = p_target_task_template_id;
  insert into public.task_template_equipment_items (
    task_template_id, equipment_asset_id, equipment_name, is_required,
    default_quantity, unit, notes, sort_order
  )
  select p_target_task_template_id, equipment_asset_id, equipment_name, is_required,
    default_quantity, unit, notes, sort_order
  from public.task_template_equipment_items
  where task_template_id = p_source_task_template_id;
end;
$$;

notify pgrst, 'reload schema';
