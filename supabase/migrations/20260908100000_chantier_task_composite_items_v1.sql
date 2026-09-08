-- Quand un ouvrage est adapté au moment du chiffrage (quantités revues pour ce
-- chantier), cette composition doit suivre jusqu'à la tâche de chantier. Elle prime
-- alors sur les ratios du modèle de tâche, qui restent la référence en bibliothèque.

alter table public.chantier_tasks
  add column if not exists composite_items jsonb;
