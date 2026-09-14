-- Marge par défaut de l'entreprise.
--
-- Le taux appliqué au déboursé pour obtenir un prix de vente était écrit dans le
-- code (30 %). Il se règle maintenant dans Mon entreprise, et reste la valeur de
-- repli des tâches qui n'ont pas la leur.
--
-- NULL = 30 %, le comportement d'avant.

alter table public.company_settings
  add column if not exists default_margin_rate numeric;
