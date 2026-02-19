create table if not exists public.company_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default auth.uid(),
  company_name text not null default '',
  logo_path text,
  address text,
  phone text,
  email text,
  siret text,
  insurance_decennale text,
  primary_color text not null default '#2563eb',
  secondary_color text not null default '#0f172a',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint company_settings_org_unique unique (organization_id),
  constraint company_settings_primary_color_chk check (primary_color ~ '^#([0-9A-Fa-f]{6})$'),
  constraint company_settings_secondary_color_chk check (secondary_color ~ '^#([0-9A-Fa-f]{6})$')
);

alter table public.company_settings enable row level security;

create index if not exists company_settings_org_idx on public.company_settings (organization_id);

drop policy if exists company_settings_select_own on public.company_settings;
create policy company_settings_select_own
  on public.company_settings
  for select
  to authenticated
  using (organization_id = auth.uid());

drop policy if exists company_settings_insert_own on public.company_settings;
create policy company_settings_insert_own
  on public.company_settings
  for insert
  to authenticated
  with check (organization_id = auth.uid());

drop policy if exists company_settings_update_own on public.company_settings;
create policy company_settings_update_own
  on public.company_settings
  for update
  to authenticated
  using (organization_id = auth.uid())
  with check (organization_id = auth.uid());

drop policy if exists company_settings_delete_own on public.company_settings;
create policy company_settings_delete_own
  on public.company_settings
  for delete
  to authenticated
  using (organization_id = auth.uid());

drop trigger if exists trg_company_settings_updated_at on public.company_settings;
create trigger trg_company_settings_updated_at
before update on public.company_settings
for each row execute function public.set_updated_at();

grant select, insert, update, delete on table public.company_settings to authenticated;

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default auth.uid(),
  name text not null,
  specialty text,
  address text,
  city text,
  phone text,
  email text,
  siret text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.suppliers enable row level security;

create index if not exists suppliers_org_idx on public.suppliers (organization_id);
create index if not exists suppliers_name_idx on public.suppliers (lower(name));

drop policy if exists suppliers_select_own on public.suppliers;
create policy suppliers_select_own
  on public.suppliers
  for select
  to authenticated
  using (organization_id = auth.uid());

drop policy if exists suppliers_insert_own on public.suppliers;
create policy suppliers_insert_own
  on public.suppliers
  for insert
  to authenticated
  with check (organization_id = auth.uid());

drop policy if exists suppliers_update_own on public.suppliers;
create policy suppliers_update_own
  on public.suppliers
  for update
  to authenticated
  using (organization_id = auth.uid())
  with check (organization_id = auth.uid());

drop policy if exists suppliers_delete_own on public.suppliers;
create policy suppliers_delete_own
  on public.suppliers
  for delete
  to authenticated
  using (organization_id = auth.uid());

drop trigger if exists trg_suppliers_updated_at on public.suppliers;
create trigger trg_suppliers_updated_at
before update on public.suppliers
for each row execute function public.set_updated_at();

grant select, insert, update, delete on table public.suppliers to authenticated;
