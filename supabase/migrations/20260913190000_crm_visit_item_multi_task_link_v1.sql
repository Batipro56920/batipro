-- Relevé terrain : une ligne de pré-devis peut porter plusieurs tâches.
--
-- Un intitulé annoncé au client ("Remplacement complet du TGBT") correspond
-- souvent à plusieurs gestes de la bibliothèque (dépose, pose, raccordements,
-- mise en service). Avec un seul lien, tout ce qui n'était pas la tâche
-- choisie disparaissait du chiffrage puis du chantier.
--
-- task_template_id reste renseigné avec la première tâche liée : toute la
-- chaîne existante (devis, chantier, préparation matériaux) continue de le
-- lire sans changement.

alter table public.crm_visit_report_items
  add column if not exists task_template_ids uuid[] not null default '{}'::uuid[];

alter table public.crm_visit_report_items
  add column if not exists task_template_labels text[] not null default '{}'::text[];

-- Reprise des lignes déjà saisies avec un lien unique.
update public.crm_visit_report_items
set
  task_template_ids = array[task_template_id],
  task_template_labels = case
    when coalesce(task_template_label, '') = '' then '{}'::text[]
    else array[task_template_label]
  end
where task_template_id is not null
  and coalesce(array_length(task_template_ids, 1), 0) = 0;

create index if not exists crm_visit_report_items_task_template_ids_idx
  on public.crm_visit_report_items using gin (task_template_ids);

-- Le devis transporte la meme liste : sans elle, tout ce qui n'etait pas la
-- premiere tache disparaissait entre le releve et le chantier.
alter table public.crm_quote_items
  add column if not exists task_template_ids uuid[] not null default '{}'::uuid[];

update public.crm_quote_items
set task_template_ids = array[task_template_id]
where task_template_id is not null
  and coalesce(array_length(task_template_ids, 1), 0) = 0;

create index if not exists crm_quote_items_task_template_ids_idx
  on public.crm_quote_items using gin (task_template_ids);
