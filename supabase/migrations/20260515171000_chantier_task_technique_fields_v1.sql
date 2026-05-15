alter table public.chantier_tasks
  add column if not exists materiaux text null,
  add column if not exists contraintes text null,
  add column if not exists points_controle text null;
