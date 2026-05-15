alter table public.task_templates
  add column if not exists element_type text not null default 'task',
  add column if not exists purchase_price_ht numeric not null default 0,
  add column if not exists sale_price_ht numeric not null default 0,
  add column if not exists hourly_cost_ht numeric not null default 45,
  add column if not exists default_tva_rate numeric not null default 20,
  add column if not exists supplier_id uuid null,
  add column if not exists supplier_reference text,
  add column if not exists family text,
  add column if not exists tags text[] not null default '{}'::text[],
  add column if not exists commercial_description text,
  add column if not exists quote_visible boolean not null default true,
  add column if not exists chantier_visible boolean not null default true;

alter table public.crm_quote_items
  add column if not exists section_id uuid null,
  add column if not exists parent_item_id uuid null references public.crm_quote_items(id) on delete cascade,
  add column if not exists line_type text not null default 'simple',
  add column if not exists family text,
  add column if not exists supplier_reference text,
  add column if not exists price_status text not null default 'estimated',
  add column if not exists show_to_client boolean not null default true,
  add column if not exists page_break_before boolean not null default false,
  add column if not exists numbering text;

alter table public.crm_quotes
  add column if not exists revision int not null default 1,
  add column if not exists archived_at timestamptz,
  add column if not exists display_options jsonb not null default '{}'::jsonb,
  add column if not exists payment_terms_text text,
  add column if not exists legal_mentions jsonb not null default '{}'::jsonb,
  add column if not exists waste_management jsonb not null default '{}'::jsonb,
  add column if not exists client_link_token text,
  add column if not exists sent_at timestamptz,
  add column if not exists last_reminder_at timestamptz,
  add column if not exists signatory_name text,
  add column if not exists client_comment text;

create table if not exists public.crm_quote_sections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default auth.uid(),
  quote_id uuid not null references public.crm_quotes(id) on delete cascade,
  parent_id uuid references public.crm_quote_sections(id) on delete cascade,
  title text not null,
  description text,
  section_type text not null default 'section',
  ordre int not null default 0,
  numbering text,
  show_total boolean not null default true,
  page_break_before boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_quote_components (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default auth.uid(),
  quote_id uuid not null references public.crm_quotes(id) on delete cascade,
  quote_item_id uuid not null references public.crm_quote_items(id) on delete cascade,
  component_type text not null default 'material',
  family text,
  designation text not null,
  unit text,
  quantity numeric not null default 1,
  purchase_unit_price_ht numeric not null default 0,
  sale_unit_price_ht numeric not null default 0,
  total_cost_ht numeric not null default 0,
  total_sale_ht numeric not null default 0,
  gross_margin_ht numeric not null default 0,
  margin_rate numeric not null default 0,
  tva_rate numeric not null default 20,
  supplier_id uuid null,
  supplier_reference text,
  price_status text not null default 'estimated',
  lead_time_days int,
  last_price_update_at timestamptz,
  ordre int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_quote_revisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default auth.uid(),
  quote_id uuid not null references public.crm_quotes(id) on delete cascade,
  revision int not null,
  status text not null,
  totals jsonb not null default '{}'::jsonb,
  snapshot jsonb not null default '{}'::jsonb,
  pdf_document_id uuid references public.crm_documents(id) on delete set null,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  unique (quote_id, revision)
);

create table if not exists public.crm_quote_signatures (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default auth.uid(),
  quote_id uuid not null references public.crm_quotes(id) on delete cascade,
  revision int not null default 1,
  status text not null default 'pending',
  signatory_name text,
  signatory_email text,
  client_comment text,
  ip_address text,
  user_agent text,
  accepted_at timestamptz,
  refused_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.crm_payment_terms (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default auth.uid(),
  quote_id uuid references public.crm_quotes(id) on delete cascade,
  label text not null,
  percent numeric,
  amount_ht numeric,
  amount_ttc numeric,
  due_trigger text,
  due_date date,
  payment_methods text[] not null default '{}'::text[],
  notes text,
  ordre int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_purchases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default auth.uid(),
  chantier_id uuid references public.chantiers(id) on delete set null,
  quote_id uuid references public.crm_quotes(id) on delete set null,
  quote_item_id uuid references public.crm_quote_items(id) on delete set null,
  supplier_id uuid null,
  lot text,
  category text not null default 'materials',
  label text not null,
  purchase_date date,
  amount_ht numeric not null default 0,
  tva_rate numeric not null default 20,
  amount_ttc numeric not null default 0,
  status text not null default 'planned',
  invoice_document_id uuid references public.crm_documents(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists crm_quote_sections_quote_idx on public.crm_quote_sections (quote_id, parent_id, ordre);
create index if not exists crm_quote_components_item_idx on public.crm_quote_components (quote_item_id, ordre);
create index if not exists crm_quote_components_quote_idx on public.crm_quote_components (quote_id);
create index if not exists crm_quote_revisions_quote_idx on public.crm_quote_revisions (quote_id, revision desc);
create index if not exists crm_quote_signatures_quote_idx on public.crm_quote_signatures (quote_id, revision);
create index if not exists crm_payment_terms_quote_idx on public.crm_payment_terms (quote_id, ordre);
create index if not exists crm_purchases_chantier_idx on public.crm_purchases (chantier_id, status);
create index if not exists crm_purchases_quote_idx on public.crm_purchases (quote_id);
create index if not exists task_templates_quote_catalog_idx on public.task_templates (quote_visible, element_type, family);

alter table public.crm_quote_sections enable row level security;
alter table public.crm_quote_components enable row level security;
alter table public.crm_quote_revisions enable row level security;
alter table public.crm_quote_signatures enable row level security;
alter table public.crm_payment_terms enable row level security;
alter table public.crm_purchases enable row level security;

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'crm_quote_sections',
    'crm_quote_components',
    'crm_quote_revisions',
    'crm_quote_signatures',
    'crm_payment_terms',
    'crm_purchases'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', tbl || '_own_org', tbl);
    execute format(
      'create policy %I on public.%I for all to authenticated using (organization_id = auth.uid()) with check (organization_id = auth.uid())',
      tbl || '_own_org',
      tbl
    );
  end loop;
end $$;

create trigger crm_quote_sections_updated_at
before update on public.crm_quote_sections
for each row execute function public.set_updated_at();

create trigger crm_quote_components_updated_at
before update on public.crm_quote_components
for each row execute function public.set_updated_at();

create trigger crm_payment_terms_updated_at
before update on public.crm_payment_terms
for each row execute function public.set_updated_at();

create trigger crm_purchases_updated_at
before update on public.crm_purchases
for each row execute function public.set_updated_at();
