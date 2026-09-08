-- "Configurer l'ouvrage" laissait saisir une composition (fournitures, main d'oeuvre,
-- matériel) qui n'était stockée nulle part : elle disparaissait à l'enregistrement.
-- Cette composition est propre au devis — adapter un ouvrage pour un chantier ne doit
-- jamais modifier le modèle de tâche de la bibliothèque — on la stocke donc sur la
-- ligne de devis elle-même.

alter table public.crm_quote_items
  add column if not exists composite_items jsonb;
