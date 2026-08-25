-- Nouveau profil type "Chef de projet" : accès complet sauf le module financier.
-- profile_permission_presets.preset_id est verrouillé par une liste fermée
-- (CHECK), il faut l'étendre avant qu'un enregistrement pour ce nouveau
-- preset_id puisse être inséré.

alter table public.profile_permission_presets
  drop constraint if exists profile_permission_presets_preset_id_check;

alter table public.profile_permission_presets
  add constraint profile_permission_presets_preset_id_check
  check (preset_id = any (array[
    'dirigeant',
    'commercial',
    'chef_de_projet',
    'conducteur_de_travaux',
    'comptable',
    'administratif',
    'intervenant_terrain',
    'sous_traitant'
  ]));
