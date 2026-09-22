-- Les pièces concernées suivent la ligne jusqu'au devis.
--
-- Le relevé savait déjà dire "ces trois murs de la chambre 1". Le devis, lui,
-- perdait l'information : le chantier recevait des tâches sans localisation, à
-- rattacher de nouveau aux zones à la main.
--
-- Forme : [{ roomId, roomName, measure, value }]

alter table public.crm_quote_items
  add column if not exists zone_links jsonb not null default '[]'::jsonb;

comment on column public.crm_quote_items.zone_links is
  'Pièces concernées par la ligne, reprises du relevé : servent à rattacher la tâche de chantier à ses zones.';

notify pgrst, 'reload schema';
