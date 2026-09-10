-- Rattacher aussi les entrées nées d'une fiche produit validée au bureau.
--
-- Quand une ligne du bon n'était pas au catalogue, l'entrée de stock n'est
-- créée qu'à la validation de la fiche, bien après le bon. Le lien existe
-- pourtant : la proposition sait de quel bon elle vient.

update public.product_stock_movements as m
set delivery_note_id = p.delivery_note_id
from public.product_catalog_proposals as p
where m.delivery_note_id is null
  and m.movement_type = 'entree'
  and p.delivery_note_id is not null
  and p.product_id = m.product_id
  and p.chantier_id is not distinct from m.chantier_id
  and p.status = 'accepted';
