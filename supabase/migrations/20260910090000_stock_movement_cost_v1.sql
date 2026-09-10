-- Prix des matériaux réellement reçus.
--
-- Un bon de livraison porte souvent les prix. Jusqu'ici ils étaient perdus : le
-- mouvement de stock ne retenait qu'une quantité, et le coût matériaux d'un
-- chantier ne pouvait venir que d'une saisie manuelle au bureau.

alter table public.product_stock_movements
  add column if not exists unit_price_ht numeric;

alter table public.product_stock_movements
  add column if not exists supplier_id uuid references public.suppliers(id) on delete set null;

comment on column public.product_stock_movements.unit_price_ht is
  'Prix unitaire HT lu sur le bon de livraison, quand le document l''affiche.';

create index if not exists product_stock_movements_chantier_idx
  on public.product_stock_movements (chantier_id, movement_type);
