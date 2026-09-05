create table if not exists public.chantier_material_preparations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default auth.uid(),
  chantier_id uuid not null references public.chantiers(id) on delete cascade,
  aggregation_key text not null,
  material_name text not null,
  quantity numeric not null default 0,
  unit text not null default 'u',
  unit_cost_ht numeric null,
  product_id uuid null references public.product_catalog_items(id) on delete set null,
  supplier_id uuid null references public.suppliers(id) on delete set null,
  supplier_name text null,
  source text not null default 'auto' check (source in ('auto', 'manual')),
  purchase_order_id uuid null references public.purchase_orders(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chantier_material_preparations_name_chk check (char_length(btrim(material_name)) > 0),
  constraint chantier_material_preparations_unique_key unique (chantier_id, aggregation_key)
);

create index if not exists chantier_material_preparations_chantier_idx
  on public.chantier_material_preparations (organization_id, chantier_id);
create index if not exists chantier_material_preparations_po_idx
  on public.chantier_material_preparations (purchase_order_id) where purchase_order_id is not null;

alter table public.chantier_material_preparations enable row level security;

drop policy if exists chantier_material_preparations_org_select on public.chantier_material_preparations;
drop policy if exists chantier_material_preparations_org_insert on public.chantier_material_preparations;
drop policy if exists chantier_material_preparations_org_update on public.chantier_material_preparations;
drop policy if exists chantier_material_preparations_org_delete on public.chantier_material_preparations;

create policy chantier_material_preparations_org_select
  on public.chantier_material_preparations for select to authenticated
  using (organization_id = auth.uid());
create policy chantier_material_preparations_org_insert
  on public.chantier_material_preparations for insert to authenticated
  with check (organization_id = auth.uid());
create policy chantier_material_preparations_org_update
  on public.chantier_material_preparations for update to authenticated
  using (organization_id = auth.uid()) with check (organization_id = auth.uid());
create policy chantier_material_preparations_org_delete
  on public.chantier_material_preparations for delete to authenticated
  using (organization_id = auth.uid());

grant select, insert, update, delete on table public.chantier_material_preparations to authenticated;
