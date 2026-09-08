-- Séparer la provenance de l'apporteur d'affaires.
--
-- "apporteur_affaire" servait de fourre-tout pour le nom associé à la source :
-- un prospect venu d'une recommandation y stockait le nom du recommandant, et
-- le projet s'affichait ensuite comme "issu d'un apporteur d'affaires", avec le
-- suivi de commissions qui va avec. Un apporteur d'affaires et une simple
-- recommandation ne sont pas la même chose.

alter table public.crm_prospects
  add column if not exists source_detail text;

comment on column public.crm_prospects.source_detail is
  'Nom associé à la provenance (recommandé par, commercial, agent immobilier...). Un apporteur d''affaires rémunéré se renseigne dans apporteur_affaire.';

-- Rapatrie les noms qui n'ont jamais désigné un apporteur d'affaires.
update public.crm_prospects
set
  source_detail = coalesce(source_detail, apporteur_affaire),
  apporteur_affaire = null
where apporteur_affaire is not null
  and coalesce(source_acquisition, '') not ilike '%apporteur%';
