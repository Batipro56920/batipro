-- Produits vus sur un bon de livraison mais absents du catalogue.
--
-- Jusqu'ici une ligne que l'ouvrier ne savait pas rattacher disparaissait :
-- ni stock, ni coût, aucune trace. Elle devient une proposition, pré-remplie
-- par Coco, que le bureau valide avant toute entrée au catalogue — un produit
-- mal créé pollue durablement tous les coûts qui en dépendent.

create table if not exists public.product_catalog_proposals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default auth.uid(),
  chantier_id uuid null references public.chantiers(id) on delete set null,
  delivery_note_id uuid null references public.delivery_notes(id) on delete set null,
  supplier_id uuid null references public.suppliers(id) on delete set null,
  supplier_name text null,
  designation text not null,
  quantity numeric not null default 0,
  unit text not null default 'u',
  unit_price_ht numeric null,
  storage_bucket text null,
  storage_path text null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  product_id uuid null references public.product_catalog_items(id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz null
);

create index if not exists product_catalog_proposals_pending_idx
  on public.product_catalog_proposals (organization_id, status, created_at desc);

alter table public.product_catalog_proposals enable row level security;

drop policy if exists product_catalog_proposals_org_select on public.product_catalog_proposals;
drop policy if exists product_catalog_proposals_org_insert on public.product_catalog_proposals;
drop policy if exists product_catalog_proposals_org_update on public.product_catalog_proposals;
drop policy if exists product_catalog_proposals_org_delete on public.product_catalog_proposals;

create policy product_catalog_proposals_org_select on public.product_catalog_proposals
  for select to authenticated using (organization_id = auth.uid());
create policy product_catalog_proposals_org_insert on public.product_catalog_proposals
  for insert to authenticated with check (organization_id = auth.uid());
create policy product_catalog_proposals_org_update on public.product_catalog_proposals
  for update to authenticated using (organization_id = auth.uid()) with check (organization_id = auth.uid());
create policy product_catalog_proposals_org_delete on public.product_catalog_proposals
  for delete to authenticated using (organization_id = auth.uid());
