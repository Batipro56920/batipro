-- Complète le template "Ferraillage et coulage béton dallage" avec le
-- matériel/outillage nécessaire à la tâche "Coulage béton dallage" — cette
-- section existait dans le schéma (task_template_equipment_items) et dans le
-- formulaire bibliothèque, mais n'était jamais alimentée ni affichée côté
-- portail intervenant. Corrigé en base en attendant que la bibliothèque
-- (formulaire de saisie) soit fiabilisée pour ce genre d'ajout.

delete from public.task_template_equipment_items
where task_template_id = 'b86e79a2-6c13-43dd-bb4c-d8f4b4e7287d';

insert into public.task_template_equipment_items (
  task_template_id,
  equipment_name,
  is_required,
  default_quantity,
  unit,
  notes,
  sort_order
) values
  ('b86e79a2-6c13-43dd-bb4c-d8f4b4e7287d', 'Règle vibrante', true, 1, 'u', null, 0),
  ('b86e79a2-6c13-43dd-bb4c-d8f4b4e7287d', 'Aiguille vibrante (vibreur à béton)', true, 1, 'u', null, 1),
  ('b86e79a2-6c13-43dd-bb4c-d8f4b4e7287d', 'Taloche mécanique', true, 1, 'u', null, 2),
  ('b86e79a2-6c13-43dd-bb4c-d8f4b4e7287d', 'Brouette', false, 2, 'u', null, 3);
