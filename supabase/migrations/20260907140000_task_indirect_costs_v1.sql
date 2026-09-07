-- Coûts indirects d'entreprise (amortissement matériel + heures productives) et
-- préparation Coco structurée des modèles de tâche.
-- L'amortissement et les frais généraux sont ramenés à un coût horaire pour pouvoir
-- être imputés au temps de main d'oeuvre d'une tâche.

alter table public.company_settings
  add column if not exists indirect_costs jsonb;

alter table public.task_templates
  add column if not exists coco_preparation jsonb not null default '{}'::jsonb;
