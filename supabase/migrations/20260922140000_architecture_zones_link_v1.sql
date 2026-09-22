-- L'architecture relevée en visite et les zones du chantier : un seul langage.
--
-- Les pièces étaient mesurées au relevé, puis les zones du chantier étaient
-- ressaisies à la main, sans dimensions. Les zones portent désormais les mêmes
-- cotes, et gardent le lien vers la pièce d'où elles viennent.

alter table public.chantier_zones
  add column if not exists longueur_m numeric,
  add column if not exists largeur_m numeric,
  add column if not exists hauteur_m numeric,
  add column if not exists ouvertures_m2 numeric,
  add column if not exists deduction_plinthes_ml numeric,
  add column if not exists source_room_id text;

comment on column public.chantier_zones.source_room_id is
  'Identifiant de la pièce du relevé de visite dont cette zone est issue.';

-- Une ligne de pré-devis dit quelles pièces elle concerne, et pour chacune la
-- quantité réellement retenue : trois murs sur quatre, un seul plafond repris.
-- Forme : [{ roomId, roomName, measure, value }]
alter table public.crm_visit_report_items
  add column if not exists zone_links jsonb not null default '[]'::jsonb;

comment on column public.crm_visit_report_items.zone_links is
  'Pièces concernées par la ligne, avec la mesure retenue et la quantité ajustée au réel.';

notify pgrst, 'reload schema';
