do $$
begin
  if to_regclass('public.profiles') is not null then
    alter table public.profiles
      add column if not exists feature_permissions jsonb not null default '{}'::jsonb;

    update public.profiles
    set feature_permissions = '{}'::jsonb
    where feature_permissions is null
      or jsonb_typeof(feature_permissions) <> 'object';
  end if;
end $$;

drop function if exists public.batipro_has_feature_permission(text);
create or replace function public.batipro_has_feature_permission(p_key text)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'ADMIN'
      and coalesce((p.feature_permissions ->> p_key)::boolean, false)
  );
$$;

revoke all on function public.batipro_has_feature_permission(text) from public;
grant execute on function public.batipro_has_feature_permission(text) to authenticated;

drop function if exists public.batipro_can_access_task_library_preparation();
create or replace function public.batipro_can_access_task_library_preparation()
returns boolean
language sql
stable
as $$
  select public.batipro_has_feature_permission('task_library_preparation');
$$;

revoke all on function public.batipro_can_access_task_library_preparation() from public;
grant execute on function public.batipro_can_access_task_library_preparation() to authenticated;

create table if not exists public.task_template_material_ratios (
  id uuid primary key default gen_random_uuid(),
  task_template_id uuid not null references public.task_templates(id) on delete cascade,
  material_name text not null,
  source_unit text not null,
  ratio_quantity numeric not null,
  ratio_unit text not null,
  loss_percent numeric null,
  notes text null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint task_template_material_ratios_name_chk check (char_length(btrim(material_name)) > 0),
  constraint task_template_material_ratios_source_unit_chk check (char_length(btrim(source_unit)) > 0),
  constraint task_template_material_ratios_ratio_unit_chk check (char_length(btrim(ratio_unit)) > 0),
  constraint task_template_material_ratios_ratio_quantity_chk check (ratio_quantity >= 0),
  constraint task_template_material_ratios_loss_percent_chk check (loss_percent is null or (loss_percent >= 0 and loss_percent <= 100))
);

create index if not exists task_template_material_ratios_template_idx
  on public.task_template_material_ratios(task_template_id, sort_order, created_at);

create table if not exists public.task_template_equipment_items (
  id uuid primary key default gen_random_uuid(),
  task_template_id uuid not null references public.task_templates(id) on delete cascade,
  equipment_name text not null,
  is_required boolean not null default false,
  default_quantity numeric null,
  unit text null,
  notes text null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint task_template_equipment_items_name_chk check (char_length(btrim(equipment_name)) > 0),
  constraint task_template_equipment_items_default_quantity_chk check (default_quantity is null or default_quantity >= 0)
);

create index if not exists task_template_equipment_items_template_idx
  on public.task_template_equipment_items(task_template_id, sort_order, created_at);

alter table public.task_template_material_ratios enable row level security;
alter table public.task_template_equipment_items enable row level security;

drop policy if exists task_template_material_ratios_access on public.task_template_material_ratios;
create policy task_template_material_ratios_access
  on public.task_template_material_ratios
  for all
  to authenticated
  using (public.batipro_can_access_task_library_preparation())
  with check (public.batipro_can_access_task_library_preparation());

drop policy if exists task_template_equipment_items_access on public.task_template_equipment_items;
create policy task_template_equipment_items_access
  on public.task_template_equipment_items
  for all
  to authenticated
  using (public.batipro_can_access_task_library_preparation())
  with check (public.batipro_can_access_task_library_preparation());

grant select, insert, update, delete on table public.task_template_material_ratios to authenticated;
grant select, insert, update, delete on table public.task_template_equipment_items to authenticated;

drop function if exists public.replace_task_template_preparation(uuid, jsonb, jsonb);
create or replace function public.replace_task_template_preparation(
  p_task_template_id uuid,
  p_materials jsonb default '[]'::jsonb,
  p_equipment jsonb default '[]'::jsonb
)
returns void
language plpgsql
as $$
declare
  v_material jsonb;
  v_equipment jsonb;
begin
  if auth.uid() is null or not public.batipro_can_access_task_library_preparation() then
    raise exception 'Forbidden';
  end if;

  if p_task_template_id is null then
    raise exception 'task_template_id manquant';
  end if;

  if not exists (select 1 from public.task_templates tt where tt.id = p_task_template_id) then
    raise exception 'task_template introuvable';
  end if;

  v_material := case
    when jsonb_typeof(coalesce(p_materials, '[]'::jsonb)) = 'array' then coalesce(p_materials, '[]'::jsonb)
    else '[]'::jsonb
  end;
  v_equipment := case
    when jsonb_typeof(coalesce(p_equipment, '[]'::jsonb)) = 'array' then coalesce(p_equipment, '[]'::jsonb)
    else '[]'::jsonb
  end;

  delete from public.task_template_material_ratios
  where task_template_id = p_task_template_id;

  insert into public.task_template_material_ratios (
    task_template_id,
    material_name,
    source_unit,
    ratio_quantity,
    ratio_unit,
    loss_percent,
    notes,
    sort_order
  )
  select
    p_task_template_id,
    btrim(coalesce(item.entry ->> 'material_name', '')),
    btrim(coalesce(item.entry ->> 'source_unit', '')),
    coalesce(nullif(item.entry ->> 'ratio_quantity', ''), '0')::numeric,
    btrim(coalesce(item.entry ->> 'ratio_unit', '')),
    case
      when nullif(item.entry ->> 'loss_percent', '') is null then null
      else (item.entry ->> 'loss_percent')::numeric
    end,
    nullif(btrim(coalesce(item.entry ->> 'notes', '')), ''),
    coalesce(
      case
        when nullif(item.entry ->> 'sort_order', '') is null then null
        else (item.entry ->> 'sort_order')::integer
      end,
      item.ord::integer - 1
    )
  from jsonb_array_elements(v_material) with ordinality as item(entry, ord)
  where char_length(btrim(coalesce(item.entry ->> 'material_name', ''))) > 0;

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
    btrim(coalesce(item.entry ->> 'equipment_name', '')),
    coalesce((item.entry ->> 'is_required')::boolean, false),
    case
      when nullif(item.entry ->> 'default_quantity', '') is null then null
      else (item.entry ->> 'default_quantity')::numeric
    end,
    nullif(btrim(coalesce(item.entry ->> 'unit', '')), ''),
    nullif(btrim(coalesce(item.entry ->> 'notes', '')), ''),
    coalesce(
      case
        when nullif(item.entry ->> 'sort_order', '') is null then null
        else (item.entry ->> 'sort_order')::integer
      end,
      item.ord::integer - 1
    )
  from jsonb_array_elements(v_equipment) with ordinality as item(entry, ord)
  where char_length(btrim(coalesce(item.entry ->> 'equipment_name', ''))) > 0;
end;
$$;

revoke all on function public.replace_task_template_preparation(uuid, jsonb, jsonb) from public;
grant execute on function public.replace_task_template_preparation(uuid, jsonb, jsonb) to authenticated;

drop function if exists public.copy_task_template_preparation(uuid, uuid);
create or replace function public.copy_task_template_preparation(
  p_source_task_template_id uuid,
  p_target_task_template_id uuid
)
returns void
language plpgsql
as $$
begin
  if auth.uid() is null or not public.batipro_can_access_task_library_preparation() then
    raise exception 'Forbidden';
  end if;

  if p_source_task_template_id is null or p_target_task_template_id is null then
    raise exception 'task_template_id manquant';
  end if;

  delete from public.task_template_material_ratios
  where task_template_id = p_target_task_template_id;

  insert into public.task_template_material_ratios (
    task_template_id,
    material_name,
    source_unit,
    ratio_quantity,
    ratio_unit,
    loss_percent,
    notes,
    sort_order
  )
  select
    p_target_task_template_id,
    material_name,
    source_unit,
    ratio_quantity,
    ratio_unit,
    loss_percent,
    notes,
    sort_order
  from public.task_template_material_ratios
  where task_template_id = p_source_task_template_id
  order by sort_order asc, created_at asc;

  delete from public.task_template_equipment_items
  where task_template_id = p_target_task_template_id;

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
    p_target_task_template_id,
    equipment_name,
    is_required,
    default_quantity,
    unit,
    notes,
    sort_order
  from public.task_template_equipment_items
  where task_template_id = p_source_task_template_id
  order by sort_order asc, created_at asc;
end;
$$;

revoke all on function public.copy_task_template_preparation(uuid, uuid) from public;
grant execute on function public.copy_task_template_preparation(uuid, uuid) to authenticated;
