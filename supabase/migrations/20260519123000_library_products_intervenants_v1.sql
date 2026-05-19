-- V1 metier Produits -> Bibliotheque/Ouvrages -> Intervenants.

alter table if exists public.product_catalog_items
  add column if not exists is_sellable boolean not null default true;

alter table if exists public.task_templates
  add column if not exists labor_items jsonb not null default '[]'::jsonb,
  add column if not exists fee_items jsonb not null default '[]'::jsonb;

alter table if exists public.task_template_material_ratios
  add column if not exists product_id uuid null,
  add column if not exists supplier_id uuid null,
  add column if not exists purchase_price_ht numeric null,
  add column if not exists sale_price_ht numeric null,
  add column if not exists price_source text null,
  add column if not exists manual_override boolean not null default false;

do $$
begin
  if to_regclass('public.task_template_material_ratios') is not null
     and to_regclass('public.product_catalog_items') is not null
     and not exists (
       select 1 from pg_constraint
       where conname = 'task_template_material_ratios_product_id_fkey'
     ) then
    alter table public.task_template_material_ratios
      add constraint task_template_material_ratios_product_id_fkey
      foreign key (product_id) references public.product_catalog_items(id) on delete set null;
  end if;
end $$;

alter table if exists public.intervenants
  add column if not exists status text not null default 'subcontractor',
  add column if not exists job_title text null,
  add column if not exists hourly_cost_ht numeric null,
  add column if not exists hourly_sale_price_ht numeric null,
  add column if not exists entry_date date null,
  add column if not exists is_active boolean not null default true,
  add column if not exists subcontractor_company text null,
  add column if not exists specialty text null,
  add column if not exists daily_rate_ht numeric null,
  add column if not exists insurance text null,
  add column if not exists legal_documents jsonb not null default '[]'::jsonb;

do $$
begin
  if to_regclass('public.intervenants') is not null
     and not exists (
       select 1 from pg_constraint
       where conname = 'intervenants_status_check'
     ) then
    alter table public.intervenants
      add constraint intervenants_status_check
      check (status in ('employee', 'subcontractor', 'temporary_worker', 'partner', 'other'));
  end if;
end $$;

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
