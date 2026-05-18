# QA - PV de réception chantier

## Accès

- [ ] Ouvrir `/chantiers/:id`.
- [ ] Aller dans la section `Qualité`.
- [ ] Vérifier que le bloc `PV de réception` est visible.

## Contenu

- [ ] Vérifier entreprise, client, chantier et adresse chantier.
- [ ] Modifier la date de réception.
- [ ] Modifier la référence projet / chantier.
- [ ] Choisir `Réception sans réserve`.
- [ ] Choisir `Réception avec réserves`.
- [ ] Choisir `Refus de réception`.
- [ ] Ajouter des observations libres.

## Réserves

- [ ] Ajouter une réserve manuelle.
- [ ] Modifier description, lot, responsable, date de levée et statut.
- [ ] Supprimer une réserve.
- [ ] Importer une réserve chantier existante.
- [ ] Vérifier qu’une réserve importée n’est pas proposée deux fois.

## Documents

- [ ] Prévisualiser le PV.
- [ ] Générer le PDF.
- [ ] Vérifier que le PDF contient la décision, les observations, les réserves et les signatures.
- [ ] Ouvrir l’assistant d’envoi.

## Sauvegarde

- [ ] Enregistrer le PV.
- [ ] Recharger la page.
- [ ] Vérifier que le PV est restauré.

## Validation technique

- [ ] `npm run build` passe.
- [ ] Aucun changement visible hors section `Qualité`.
