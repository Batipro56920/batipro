# QA — Dashboard CRM Batipro

## Routes

- [ ] `/crm` affiche le cockpit CRM.
- [ ] `/crm/prospects` reste accessible.
- [ ] `/crm/clients` reste accessible.
- [ ] `/crm/opportunites` reste accessible.
- [ ] `/crm/devis` reste accessible.
- [ ] `/crm/agenda` reste accessible.
- [ ] `/crm/sav` reste accessible.
- [ ] `/crm/statistiques` reste accessible.

## Header

- [ ] Le titre `CRM Batipro` est visible.
- [ ] Le sous-titre est lisible.
- [ ] Le bouton `Rafraîchir` recharge les données.
- [ ] Le bouton `Prospect` ouvre la modale prospect.
- [ ] Le bouton `Opportunité` ouvre la modale opportunité.
- [ ] Le bouton `Devis` crée un devis brouillon et ouvre le workspace.
- [ ] Le bouton `Agenda` navigue vers `/crm/agenda`.
- [ ] Aucun bouton du header n’est mort.

## Navigation

- [ ] Les onglets principaux sont visibles.
- [ ] Le menu `Plus` contient Factures, Achats, Contacts, Ressources, Bibliothèque, Paramètres.
- [ ] L’onglet actif est identifiable.
- [ ] Aucune route CRM existante n’est supprimée.
- [ ] Le menu `Plus` reste utilisable en tablette et mobile.

## Dashboard

- [ ] Les 6 KPI CRM s’affichent.
- [ ] Les KPI sont compacts et lisibles.
- [ ] Les KPI passent correctement en grille desktop/tablette/mobile.
- [ ] Les KPI redirigent vers les modules associés.
- [ ] Le bloc actions affiche les relances, RDV, tâches et devis si présents.
- [ ] Les cartes `Devis à envoyer` ouvrent `/crm/devis/:id/edit`.
- [ ] Si une action ne peut pas ouvrir une cible, l’état désactivé est explicite.
- [ ] L’état vide `Aucune action urgente` s’affiche si aucune action n’est disponible.
- [ ] Le bloc points de vigilance affiche les compteurs.
- [ ] L’état vide des alertes s’affiche si tout est sous contrôle.
- [ ] Le pipeline affiche les étapes commerciales.
- [ ] Les colonnes pipeline affichent nombre d’affaires et montant.
- [ ] Les colonnes vides du pipeline restent compactes.
- [ ] Le pipeline reste lisible avec scroll horizontal si l’écran est étroit.
- [ ] L’activité récente s’affiche ou montre un état vide.

## Qualité

- [ ] Aucun texte encodé de type `RafraÃ®chir`, `OpportunitÃ©s`, `BibliothÃ¨que`, `ParamÃ¨tres`.
- [ ] Desktop lisible.
- [ ] Tablette lisible.
- [ ] Mobile empilé correctement.
- [ ] Aucun bouton ajouté n’est mort.
- [ ] `npm run build` passe.
