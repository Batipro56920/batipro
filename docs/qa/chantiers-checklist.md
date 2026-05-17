# QA - Chantiers

## Routes

- [ ] `/chantiers` affiche la page Production chantier.
- [ ] `/chantiers/nouveau` reste accessible depuis le bouton Nouveau chantier.
- [ ] `/chantiers/:id` reste accessible depuis Ouvrir.

## Header et KPI

- [ ] Le titre `Production chantier` est visible.
- [ ] Les actions Nouveau chantier, Import et Export sont visibles.
- [ ] Import est désactivé clairement si non branché.
- [ ] Les 6 KPI s'affichent.
- [ ] Les KPI restent lisibles en desktop, tablette et mobile.

## Filtres et vues

- [ ] Les filtres actifs / terminés / archivés / annulés / tous conservent la logique existante.
- [ ] La recherche filtre nom, client et adresse.
- [ ] Le filtre statut fonctionne.
- [ ] Le filtre client fonctionne.
- [ ] Le filtre période fonctionne.
- [ ] Aucun filtre Commercial inutile n'est affiché.
- [ ] Le filtre Responsable est désactivé clairement tant que la donnée n'est pas reliée.
- [ ] Les vues Liste, Cartes, Planning et Kanban s'affichent.

## Actions

- [ ] Ouvrir mène à la fiche chantier.
- [ ] Terminer affiche une confirmation puis met à jour le statut.
- [ ] Archiver affiche une confirmation puis met à jour le statut.
- [ ] Annuler affiche une confirmation puis met à jour le statut.
- [ ] Restaurer remet le chantier en cours.
- [ ] Export télécharge un CSV.
- [ ] Supprimer affiche une confirmation et reste disponible uniquement sur les brouillons.
- [ ] Les bulk actions marquer terminés, archiver et supprimer brouillons fonctionnent comme avant.

## Affichage métier

- [ ] Un budget `0` ou absent affiche `Budget non renseigné`.
- [ ] Un budget positif affiche le montant formaté.
- [ ] Un temps prévu `0` et consommé `0` affiche `Temps non planifié`.
- [ ] Un temps existant affiche les heures normalement.
- [ ] Les échéances dépassées utilisent le libellé `En retard`.

## Drawer et états

- [ ] Un clic ligne/carte ouvre le drawer rapide.
- [ ] Les onglets Vue rapide, Tâches, Équipe, Documents et Alertes sont visibles.
- [ ] L'état vide premium s'affiche quand aucun chantier ne correspond.
- [ ] Le skeleton s'affiche pendant le chargement.
- [ ] Les erreurs sont lisibles.

## Validation

- [ ] Aucun bouton ajouté n'est mort.
- [ ] Aucun texte mal encodé n'apparaît.
- [ ] Responsive desktop/tablette/mobile correct.
- [ ] `npm run build` passe.
