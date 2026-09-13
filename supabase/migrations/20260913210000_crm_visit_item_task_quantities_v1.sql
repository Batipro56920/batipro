-- Quantité propre à chaque tâche liée.
--
-- Une ligne relevée "Remplacement complet du TGBT — 2 u" peut demander la pose
-- de 2 tableaux mais d'un seul interrupteur sectionneur. Sans quantité par
-- tâche, chaque geste était compté autant de fois que la ligne.
--
-- NULL dans le tableau = la tâche suit la quantité de la ligne. La position
-- correspond à celle de task_template_ids.

alter table public.crm_visit_report_items
  add column if not exists task_template_quantities numeric[] not null default '{}'::numeric[];

alter table public.crm_quote_items
  add column if not exists task_template_quantities numeric[] not null default '{}'::numeric[];
