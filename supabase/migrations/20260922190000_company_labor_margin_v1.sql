-- Marge propre à la main d'œuvre.
--
-- Une heure vendue et un sac de plâtre revendu ne se marient pas à la même
-- marge : la main d'œuvre porte le risque du chantier. Une seule marge servait
-- pour les deux, ce qui obligeait à corriger tâche par tâche.
--
-- Vide = la marge générale du chiffrage s'applique, comme avant.

alter table public.company_settings
  add column if not exists default_labor_margin_rate numeric;

comment on column public.company_settings.default_labor_margin_rate is
  'Marge appliquée à la main d''œuvre, en %. Vide : la marge par défaut du chiffrage s''applique.';

notify pgrst, 'reload schema';
