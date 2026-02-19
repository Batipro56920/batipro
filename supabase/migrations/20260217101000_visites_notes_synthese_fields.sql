alter table public.chantier_visites
  add column if not exists notes_terrain text null,
  add column if not exists remarques_planning text null,
  add column if not exists synthese text null,
  add column if not exists synthese_points_cles jsonb null;
