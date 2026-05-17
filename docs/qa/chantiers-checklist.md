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
- [ ] Les vues Liste, Cartes, Planning et Kanban s'affichent.

## Actions

- [ ] Ouvrir mène à la fiche chantier.
- [ ] Terminer met à jour le statut.
- [ ] Archiver met à jour le statut.
- [ ] Restaurer remet le chantier en cours.
- [ ] Export télécharge un CSV.
- [ ] Suppression est disponible uniquement sur les brouillons.
- [ ] Les bulk actions marquer terminés, archiver et supprimer brouillons fonctionnent comme avant.

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

