create table if not exists public.delivery_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default auth.uid(),
  supplier_id uuid null references public.suppliers(id) on delete set null,
  supplier_name text null,
  document_reference text null,
  purchase_order_id uuid null references public.purchase_orders(id) on delete set null,
  chantier_id uuid null references public.chantiers(id) on delete set null,
  status text not null default 'matched' check (status in ('matched', 'unmatched')),
  lines jsonb not null default '[]'::jsonb,
  storage_path text null,
  storage_bucket text null,
  created_at timestamptz not null default now()
);

create index if not exists delivery_notes_org_created_idx
  on public.delivery_notes (organization_id, created_at desc);
create index if not exists delivery_notes_po_idx
  on public.delivery_notes (purchase_order_id) where purchase_order_id is not null;

alter table public.delivery_notes enable row level security;

drop policy if exists delivery_notes_org_select on public.delivery_notes;
drop policy if exists delivery_notes_org_insert on public.delivery_notes;
drop policy if exists delivery_notes_org_update on public.delivery_notes;
drop policy if exists delivery_notes_org_delete on public.delivery_notes;

create policy delivery_notes_org_select
  on public.delivery_notes for select to authenticated
  using (organization_id = auth.uid());
create policy delivery_notes_org_insert
  on public.delivery_notes for insert to authenticated
  with check (organization_id = auth.uid());
create policy delivery_notes_org_update
  on public.delivery_notes for update to authenticated
  using (organization_id = auth.uid()) with check (organization_id = auth.uid());
create policy delivery_notes_org_delete
  on public.delivery_notes for delete to authenticated
  using (organization_id = auth.uid());

grant select, insert, update, delete on table public.delivery_notes to authenticated;
