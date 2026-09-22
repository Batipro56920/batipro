-- Architecture du relevé de visite : les pièces mesurées sur place.
--
-- Les quantités du pré-devis se comptaient à la main, pièce par pièce, sur un
-- carnet : sol, plafond, périmètre, murs, volume. Elles sont désormais saisies
-- une fois, en longueur / largeur / hauteur, et calculées.
--
-- Forme attendue : [{ id, name, length, width, height, openingsM2, skirtingDeductionMl, notes }]

alter table public.crm_visit_reports
  add column if not exists architecture jsonb not null default '[]'::jsonb;

comment on column public.crm_visit_reports.architecture is
  'Pièces relevées : dimensions saisies sur site, d''où sont déduits les m², ml et m³ du pré-devis.';

notify pgrst, 'reload schema';
