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

## Navigation

- [ ] Les onglets principaux sont visibles.
- [ ] Le menu `Plus` contient Factures, Achats, Contacts, Ressources, Bibliothèque, Paramètres.
- [ ] L’onglet actif est identifiable.
- [ ] Aucune route CRM existante n’est supprimée.

## Dashboard

- [ ] Les 6 KPI CRM s’affichent.
- [ ] Les KPI redirigent vers les modules associés.
- [ ] Le bloc actions affiche les relances, RDV, tâches et devis si présents.
- [ ] L’état vide `Aucune action urgente` s’affiche si aucune action n’est disponible.
- [ ] Le bloc points de vigilance affiche les compteurs.
- [ ] L’état vide des alertes s’affiche si tout est sous contrôle.
- [ ] Le pipeline affiche les étapes commerciales.
- [ ] Les colonnes pipeline affichent nombre d’affaires et montant.
- [ ] L’activité récente s’affiche ou montre un état vide.

## Qualité

- [ ] Aucun texte encodé de type `RafraÃ®chir`, `OpportunitÃ©s`, `BibliothÃ¨que`, `ParamÃ¨tres`.
- [ ] Desktop lisible.
- [ ] Tablette lisible.
- [ ] Mobile empilé correctement.
- [ ] Aucun bouton ajouté n’est mort.
- [ ] `npm run build` passe.
