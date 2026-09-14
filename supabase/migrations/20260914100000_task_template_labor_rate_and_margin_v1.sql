-- Coût horaire et marge propres à une tâche.
--
-- Le coût de main d'oeuvre d'une tâche était toujours le coût horaire moyen des
-- salariés, et la marge un taux unique pour toute l'application. Certaines
-- tâches se chiffrent pourtant autrement : un geste confié à un compagnon
-- qualifié, une prestation où la concurrence impose une marge plus courte.
--
-- NULL dans les deux colonnes = comportement d'avant : coût horaire moyen de
-- l'entreprise, et marge par défaut du chiffrage.

alter table public.task_templates
  add column if not exists labor_hourly_cost_ht numeric;

alter table public.task_templates
  add column if not exists target_margin_rate numeric;
