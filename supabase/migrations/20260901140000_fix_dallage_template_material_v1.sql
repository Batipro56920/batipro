-- Correctif de données : le matériau du template "Ferraillage et coulage
-- béton dallage" (bibliothèque) avait été enregistré avec le nom "m2" au lieu
-- du vrai produit, à cause d'un bug du formulaire "Modifier template" /
-- "Nouveau template" qui envoie parfois un tableau de matériaux vide à
-- replace_task_template_preparation malgré la saisie visible à l'écran (RPC
-- elle-même correcte, le bug est côté état React du formulaire — à
-- investiguer séparément). On corrige ici directement en base.
--
-- Supprime aussi le template en double "Coulage béton dallage" créé pendant
-- le diagnostic, qui n'est lié à aucune tâche chantier.

delete from public.task_template_material_ratios
where task_template_id = 'b86e79a2-6c13-43dd-bb4c-d8f4b4e7287d';

insert into public.task_template_material_ratios (
  task_template_id,
  product_id,
  material_name,
  source_unit,
  ratio_quantity,
  ratio_unit,
  loss_percent,
  supplier_id,
  purchase_price_ht,
  sale_price_ht,
  price_source,
  manual_override,
  is_main_material,
  notes,
  sort_order
) values (
  'b86e79a2-6c13-43dd-bb4c-d8f4b4e7287d',
  '044f480d-d454-43ea-844d-d6888839be2c',
  'Béton prêt à l''emploi C25/30 (livré toupie)',
  'm3',
  0.15,
  'm3',
  5,
  null,
  123.78,
  176.83,
  'manual',
  false,
  true,
  null,
  0
);

delete from public.task_template_material_ratios
where task_template_id = '71ecc757-4bd6-4a6d-852c-d1fae96984c0';

delete from public.task_templates
where id = '71ecc757-4bd6-4a6d-852c-d1fae96984c0';
