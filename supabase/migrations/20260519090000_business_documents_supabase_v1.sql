create table if not exists public.invoices (
  id uuid primary key,
  organization_id uuid not null default auth.uid(),
  type text not null check (type in ('deposit', 'intermediate', 'final', 'credit_note')),
  status text not null check (status in ('draft', 'sent', 'partially_paid', 'paid', 'overdue', 'cancelled')),
  document jsonb not null default '{}'::jsonb,
  source_quote_id uuid null,
  project_id uuid null,
  chantier_id uuid null references public.chantiers(id) on delete set null,
  payments jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.purchase_orders (
  id uuid primary key,
  organization_id uuid not null default auth.uid(),
  status text not null check (status in ('draft', 'sent', 'confirmed', 'partially_delivered', 'delivered', 'cancelled')),
  document jsonb not null default '{}'::jsonb,
  supplier_id uuid null references public.suppliers(id) on delete set null,
  supplier_name text null,
  project_id uuid null,
  chantier_id uuid null references public.chantiers(id) on delete set null,
  lot text null,
  supplier_reference text null,
  expected_delivery_date date null,
  delivery_address text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_catalog_items (
  id uuid primary key,
  organization_id uuid not null default auth.uid(),
  designation text not null,
  internal_reference text null,
  manufacturer_reference text null,
  brand text null,
  category text null,
  unit text not null,
  vat_rate numeric not null default 20,
  main_supplier_id uuid null references public.suppliers(id) on delete set null,
  main_supplier_name text null,
  standard_purchase_price_ht numeric not null default 0,
  recommended_sale_price_ht numeric not null default 0,
  target_margin_rate numeric not null default 0,
  supplier_prices jsonb not null default '[]'::jsonb,
  documents jsonb not null default '[]'::jsonb,
  price_history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reception_reports (
  id uuid primary key,
  organization_id uuid not null default auth.uid(),
  chantier_id uuid not null references public.chantiers(id) on delete cascade,
  status text not null check (status in ('draft', 'sent', 'signed', 'refused')),
  decision text not null check (decision in ('without_reserves', 'with_reserves', 'refused')),
  reception_date date not null,
  project_reference text null,
  observations text not null default '',
  client_signer_name text null,
  company_signer_name text null,
  reserves jsonb not null default '[]'::jsonb,
  document jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists invoices_org_status_idx on public.invoices (organization_id, status, created_at desc);
create index if not exists invoices_project_idx on public.invoices (organization_id, project_id) where project_id is not null;
create index if not exists invoices_chantier_idx on public.invoices (organization_id, chantier_id) where chantier_id is not null;

create index if not exists purchase_orders_org_status_idx on public.purchase_orders (organization_id, status, created_at desc);
create index if not exists purchase_orders_supplier_idx on public.purchase_orders (organization_id, supplier_id) where supplier_id is not null;
create index if not exists purchase_orders_chantier_idx on public.purchase_orders (organization_id, chantier_id) where chantier_id is not null;

create index if not exists product_catalog_org_category_idx on public.product_catalog_items (organization_id, category);
create index if not exists product_catalog_org_supplier_idx on public.product_catalog_items (organization_id, main_supplier_id) where main_supplier_id is not null;
create index if not exists product_catalog_org_designation_idx on public.product_catalog_items (organization_id, lower(designation));

create index if not exists reception_reports_org_chantier_idx on public.reception_reports (organization_id, chantier_id, created_at desc);
create unique index if not exists reception_reports_one_draft_per_chantier_idx
  on public.reception_reports (organization_id, chantier_id)
  where status = 'draft';

alter table public.invoices enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.product_catalog_items enable row level security;
alter table public.reception_reports enable row level security;

do $$
declare
  table_name text;
begin
  foreach table_name in array array['invoices', 'purchase_orders', 'product_catalog_items', 'reception_reports']
  loop
    execute format('drop policy if exists %I on public.%I', table_name || '_org_select', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_org_insert', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_org_update', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_org_delete', table_name);

    execute format(
      'create policy %I on public.%I for select to authenticated using (organization_id = auth.uid())',
      table_name || '_org_select',
      table_name
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (organization_id = auth.uid())',
      table_name || '_org_insert',
      table_name
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (organization_id = auth.uid()) with check (organization_id = auth.uid())',
      table_name || '_org_update',
      table_name
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (organization_id = auth.uid())',
      table_name || '_org_delete',
      table_name
    );
  end loop;
end $$;

grant select, insert, update, delete on table public.invoices to authenticated;
grant select, insert, update, delete on table public.purchase_orders to authenticated;
grant select, insert, update, delete on table public.product_catalog_items to authenticated;
grant select, insert, update, delete on table public.reception_reports to authenticated;
