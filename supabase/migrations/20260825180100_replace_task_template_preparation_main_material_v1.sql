create or replace function public.replace_task_template_preparation(
  p_task_template_id uuid,
  p_materials jsonb default '[]'::jsonb,
  p_equipment jsonb default '[]'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.task_template_material_ratios
  where task_template_id = p_task_template_id;

  insert into public.task_template_material_ratios (
    task_template_id,
    product_id,
    material_name,
    source_unit,
    ratio_quantity,
    ratio_unit,
    loss_percent,
    supplier_id,
    purchase_price_ht,
    sale_price_ht,
    price_source,
    manual_override,
    is_main_material,
    notes,
    sort_order
  )
  select
    p_task_template_id,
    nullif(item->>'product_id', '')::uuid,
    trim(item->>'material_name'),
    trim(item->>'source_unit'),
    nullif(item->>'ratio_quantity', '')::numeric,
    trim(item->>'ratio_unit'),
    nullif(item->>'loss_percent', '')::numeric,
    nullif(item->>'supplier_id', '')::uuid,
    nullif(item->>'purchase_price_ht', '')::numeric,
    nullif(item->>'sale_price_ht', '')::numeric,
    nullif(trim(item->>'price_source'), ''),
    coalesce((item->>'manual_override')::boolean, false),
    coalesce((item->>'is_main_material')::boolean, false),
    nullif(trim(item->>'notes'), ''),
    coalesce((item->>'sort_order')::integer, 0)
  from jsonb_array_elements(coalesce(p_materials, '[]'::jsonb)) as item
  where nullif(trim(item->>'material_name'), '') is not null
    and nullif(trim(item->>'source_unit'), '') is not null
    and nullif(trim(item->>'ratio_unit'), '') is not null
    and nullif(item->>'ratio_quantity', '') is not null;

  delete from public.task_template_equipment_items
  where task_template_id = p_task_template_id;

  insert into public.task_template_equipment_items (
    task_template_id,
    equipment_name,
    is_required,
    default_quantity,
    unit,
    notes,
    sort_order
  )
  select
    p_task_template_id,
    trim(item->>'equipment_name'),
    coalesce((item->>'is_required')::boolean, false),
    nullif(item->>'default_quantity', '')::numeric,
    nullif(trim(item->>'unit'), ''),
    nullif(trim(item->>'notes'), ''),
    coalesce((item->>'sort_order')::integer, 0)
  from jsonb_array_elements(coalesce(p_equipment, '[]'::jsonb)) as item
  where nullif(trim(item->>'equipment_name'), '') is not null;
end;
$$;
