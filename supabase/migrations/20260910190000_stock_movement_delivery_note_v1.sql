-- Rattacher un mouvement de stock au bon de livraison qui l'a créé.
--
-- Sans ce lien, une réception se voit dans le stock et dans le total matériaux
-- du chantier, mais rien ne dit de quel bon elle vient : impossible d'afficher
-- la livraison dans le chantier, ni de remonter au document depuis la finance.

alter table public.product_stock_movements
  add column if not exists delivery_note_id uuid references public.delivery_notes(id) on delete set null;

comment on column public.product_stock_movements.delivery_note_id is
  'Bon de livraison à l''origine du mouvement, quand il vient d''une réception.';

create index if not exists product_stock_movements_delivery_note_idx
  on public.product_stock_movements (delivery_note_id);

create index if not exists delivery_notes_chantier_idx
  on public.delivery_notes (chantier_id, created_at desc);
