create table if not exists public.quote_library_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default auth.uid(),
  type text not null check (type in ('fourniture', 'main_oeuvre', 'ouvrage', 'texte', 'section_modele', 'materiel', 'sous_traitance', 'divers')),
  title text not null,
  family text,
  description text,
  unit text,
  purchase_unit_price_ht numeric(12,2) not null default 0,
  sale_unit_price_ht numeric(12,2) not null default 0,
  vat_rate numeric(4,2) not null default 20,
  margin_rate numeric(6,2) not null default 0,
  supplier_id uuid,
  supplier_reference text,
  payload jsonb not null default '{}'::jsonb,
  tags text[] not null default '{}'::text[],
  is_favorite boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quote_library_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default auth.uid(),
  title text not null,
  family text,
  type text not null default 'devis' check (type in ('devis', 'section', 'ouvrage')),
  description text,
  nodes jsonb not null default '[]'::jsonb,
  is_favorite boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quote_imports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default auth.uid(),
  filename text not null,
  source text not null check (source in ('csv', 'xlsx')),
  status text not null default 'processed' check (status in ('pending', 'processed', 'failed')),
  row_count integer not null default 0,
  error_message text,
  created_at timestamptz not null default now()
);

create table if not exists public.quote_favorites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default auth.uid(),
  item_type text not null check (item_type in ('library_item', 'template', 'quote')),
  item_id uuid not null,
  created_at timestamptz not null default now(),
  unique (organization_id, item_type, item_id)
);

create index if not exists quote_library_items_org_type_idx on public.quote_library_items (organization_id, type) where archived_at is null;
create index if not exists quote_library_items_org_family_idx on public.quote_library_items (organization_id, family) where archived_at is null;
create index if not exists quote_library_items_org_favorite_idx on public.quote_library_items (organization_id, is_favorite) where archived_at is null;
create index if not exists quote_library_items_search_idx on public.quote_library_items using gin (to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(description, '') || ' ' || coalesce(family, '')));
create index if not exists quote_library_templates_org_type_idx on public.quote_library_templates (organization_id, type) where archived_at is null;
create index if not exists quote_imports_org_created_idx on public.quote_imports (organization_id, created_at desc);
create index if not exists quote_favorites_org_idx on public.quote_favorites (organization_id, item_type);

alter table public.quote_library_items enable row level security;
alter table public.quote_library_templates enable row level security;
alter table public.quote_imports enable row level security;
alter table public.quote_favorites enable row level security;

drop policy if exists quote_library_items_org_access on public.quote_library_items;
create policy quote_library_items_org_access on public.quote_library_items
  for all using (organization_id = auth.uid())
  with check (organization_id = auth.uid());

drop policy if exists quote_library_templates_org_access on public.quote_library_templates;
create policy quote_library_templates_org_access on public.quote_library_templates
  for all using (organization_id = auth.uid())
  with check (organization_id = auth.uid());

drop policy if exists quote_imports_org_access on public.quote_imports;
create policy quote_imports_org_access on public.quote_imports
  for all using (organization_id = auth.uid())
  with check (organization_id = auth.uid());

drop policy if exists quote_favorites_org_access on public.quote_favorites;
create policy quote_favorites_org_access on public.quote_favorites
  for all using (organization_id = auth.uid())
  with check (organization_id = auth.uid());

grant select, insert, update, delete on public.quote_library_items to authenticated;
grant select, insert, update, delete on public.quote_library_templates to authenticated;
grant select, insert, update, delete on public.quote_imports to authenticated;
grant select, insert, update, delete on public.quote_favorites to authenticated;
