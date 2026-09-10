-- Rattacher les réceptions déjà enregistrées à leur bon de livraison.
--
-- Les entrées de stock créées avant l'ajout de delivery_note_id sont orphelines :
-- elles comptent dans le coût matériaux du chantier sans qu'on puisse dire de
-- quelle livraison elles viennent. On les rapproche sur le seul faisceau fiable
-- disponible : même chantier, même produit, à quelques minutes du bon.

update public.product_stock_movements as m
set delivery_note_id = n.id
from public.delivery_notes as n
where m.delivery_note_id is null
  and m.movement_type = 'entree'
  and m.chantier_id is not null
  and n.chantier_id = m.chantier_id
  and m.created_at between n.created_at - interval '15 minutes' and n.created_at + interval '15 minutes'
  and jsonb_typeof(n.lines) = 'array'
  and exists (
    select 1
    from jsonb_array_elements(n.lines) as line
    where coalesce(line ->> 'product_id', line ->> 'productId') = m.product_id::text
  );
