alter table public.chantiers
  add column if not exists crm_client_id uuid null references public.crm_clients(id) on delete set null,
  add column if not exists crm_prospect_id uuid null references public.crm_prospects(id) on delete set null,
  add column if not exists crm_opportunity_id uuid null references public.crm_opportunities(id) on delete set null,
  add column if not exists crm_quote_id uuid null references public.crm_quotes(id) on delete set null,
  add column if not exists crm_client_phone text null,
  add column if not exists crm_client_email text null,
  add column if not exists crm_project_description text null,
  add column if not exists signed_quote_amount_ht numeric not null default 0,
  add column if not exists signed_quote_tva numeric not null default 20,
  add column if not exists signed_quote_amount_ttc numeric not null default 0,
  add column if not exists budget_labor_planned_ht numeric not null default 0,
  add column if not exists budget_materials_planned_ht numeric not null default 0,
  add column if not exists budget_subcontracting_planned_ht numeric not null default 0;

create index if not exists chantiers_crm_client_idx on public.chantiers (crm_client_id);
create index if not exists chantiers_crm_quote_idx on public.chantiers (crm_quote_id);

create table if not exists public.chantier_financial_expenses (
  id uuid primary key default gen_random_uuid(),
  chantier_id uuid not null references public.chantiers(id) on delete cascade,
  supplier_name text,
  expense_date date not null default current_date,
  category text not null default 'autre',
  description text not null,
  amount_ht numeric not null default 0,
  tva numeric not null default 20,
  amount_ttc numeric not null default 0,
  invoice_document_id uuid null references public.crm_documents(id) on delete set null,
  status text not null default 'prevu',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chantier_financial_expenses_status_chk
    check (status in ('prevu', 'commande', 'recu', 'paye')),
  constraint chantier_financial_expenses_category_chk
    check (category in ('materiaux', 'fournisseur', 'sous_traitance', 'main_oeuvre', 'deplacement', 'location_materiel', 'imprevu', 'autre'))
);

create table if not exists public.chantier_client_billings (
  id uuid primary key default gen_random_uuid(),
  chantier_id uuid not null references public.chantiers(id) on delete cascade,
  crm_invoice_id uuid null references public.crm_invoices(id) on delete set null,
  type text not null default 'acompte',
  label text not null,
  amount_ht numeric not null default 0,
  amount_ttc numeric not null default 0,
  billed_at date,
  due_date date,
  paid_amount_ttc numeric not null default 0,
  paid_at timestamptz,
  payment_status text not null default 'a_facturer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chantier_client_billings_type_chk
    check (type in ('acompte', 'situation', 'facture_finale', 'avoir', 'autre')),
  constraint chantier_client_billings_payment_status_chk
    check (payment_status in ('a_facturer', 'facture', 'partiel', 'paye', 'impaye'))
);

create table if not exists public.chantier_financial_change_orders (
  id uuid primary key default gen_random_uuid(),
  chantier_id uuid not null references public.chantiers(id) on delete cascade,
  crm_quote_id uuid null references public.crm_quotes(id) on delete set null,
  description text not null,
  amount_ht numeric not null default 0,
  status text not null default 'propose',
  document_id uuid null references public.crm_documents(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chantier_financial_change_orders_status_chk
    check (status in ('propose', 'accepte', 'refuse'))
);

create index if not exists chantier_financial_expenses_chantier_idx
  on public.chantier_financial_expenses (chantier_id, expense_date desc);
create index if not exists chantier_client_billings_chantier_idx
  on public.chantier_client_billings (chantier_id, billed_at desc);
create index if not exists chantier_financial_change_orders_chantier_idx
  on public.chantier_financial_change_orders (chantier_id, created_at desc);

create or replace function public.chantier_finance_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'chantier_financial_expenses',
    'chantier_client_billings',
    'chantier_financial_change_orders'
  ]
  loop
    execute format('drop trigger if exists %I on public.%I', table_name || '_updated_at', table_name);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.chantier_finance_set_updated_at()',
      table_name || '_updated_at',
      table_name
    );
  end loop;
end $$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'chantier_financial_expenses',
    'chantier_client_billings',
    'chantier_financial_change_orders'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_admin_all', table_name);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.batipro_has_feature_permission(''chantier_financier_view'')) with check (public.batipro_has_feature_permission(''chantier_financier_edit''))',
      table_name || '_admin_all',
      table_name
    );
  end loop;
end $$;
