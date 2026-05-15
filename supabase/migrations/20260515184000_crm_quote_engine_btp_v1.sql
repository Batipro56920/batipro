alter table public.crm_quotes
  add column if not exists conditions text,
  add column if not exists acompte_percent numeric not null default 30,
  add column if not exists signed_token text,
  add column if not exists viewed_at timestamptz,
  add column if not exists signature_ip text;

alter table public.crm_quote_items
  add column if not exists lot_id uuid null,
  add column if not exists task_template_id uuid null references public.task_templates(id) on delete set null,
  add column if not exists supplier_id uuid null,
  add column if not exists cost_materials_ht numeric not null default 0,
  add column if not exists cost_labor_ht numeric not null default 0,
  add column if not exists cost_subcontracting_ht numeric not null default 0,
  add column if not exists cost_fees_ht numeric not null default 0,
  add column if not exists labor_hours numeric not null default 0,
  add column if not exists labor_rate_ht numeric not null default 45,
  add column if not exists margin_rate numeric not null default 25,
  add column if not exists coefficient numeric not null default 1,
  add column if not exists tva_rate numeric not null default 20,
  add column if not exists sale_unit_price_ht numeric not null default 0,
  add column if not exists sale_total_ht numeric not null default 0,
  add column if not exists technical_description text,
  add column if not exists generate_task boolean not null default true;

create table if not exists public.crm_quote_lots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default auth.uid(),
  quote_id uuid not null references public.crm_quotes(id) on delete cascade,
  title text not null,
  ordre int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_quote_resources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default auth.uid(),
  quote_id uuid not null references public.crm_quotes(id) on delete cascade,
  quote_item_id uuid references public.crm_quote_items(id) on delete cascade,
  kind text not null check (kind in ('material','labor','subcontracting','fee')),
  label text not null,
  supplier_id uuid null,
  quantity numeric not null default 1,
  unit text,
  unit_cost_ht numeric not null default 0,
  tva_rate numeric not null default 20,
  margin_rate numeric not null default 0,
  total_cost_ht numeric not null default 0,
  sale_total_ht numeric not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists crm_quote_lots_quote_idx on public.crm_quote_lots (quote_id, ordre);
create index if not exists crm_quote_items_quote_lot_idx on public.crm_quote_items (quote_id, lot_id, ordre);
create index if not exists crm_quote_items_template_idx on public.crm_quote_items (task_template_id);
create index if not exists crm_quote_resources_quote_idx on public.crm_quote_resources (quote_id);
create index if not exists crm_quote_resources_item_idx on public.crm_quote_resources (quote_item_id);

alter table public.crm_quote_lots enable row level security;
alter table public.crm_quote_resources enable row level security;

do $$
declare
  tbl text;
begin
  foreach tbl in array array['crm_quote_lots','crm_quote_resources']
  loop
    execute format('drop policy if exists %I on public.%I', tbl || '_own_org', tbl);
    execute format(
      'create policy %I on public.%I for all to authenticated using (organization_id = auth.uid()) with check (organization_id = auth.uid())',
      tbl || '_own_org',
      tbl
    );
  end loop;
end $$;

create trigger crm_quote_lots_updated_at
before update on public.crm_quote_lots
for each row execute function public.set_updated_at();

create trigger crm_quote_resources_updated_at
before update on public.crm_quote_resources
for each row execute function public.set_updated_at();
