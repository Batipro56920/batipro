-- 1) Dates début/fin (type date)
alter table public.chantier_tasks
  add column if not exists date_debut date null,
  add column if not exists date_fin date null;

-- 2) Temps réel en heures (numeric)
alter table public.chantier_tasks
  add column if not exists temps_reel_h numeric null;

-- Optionnel mais recommandé : index chantier_id si pas déjà
create index if not exists chantier_tasks_chantier_id_idx
  on public.chantier_tasks (chantier_id);
