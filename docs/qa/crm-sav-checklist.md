# QA — SAV CRM

## Route

- [ ] `/crm/sav` affiche le module Service après-chantier.
- [ ] Les autres routes CRM restent accessibles.

## Header

- [ ] Titre `Service après-chantier` visible.
- [ ] Sous-titre visible.
- [ ] Bouton `Nouveau ticket` ouvre la création SAV.
- [ ] Bouton `Export` désactivé clairement.
- [ ] Bouton `Modèles réponses` désactivé clairement.

## KPI

- [ ] Tickets ouverts affichés.
- [ ] Urgents affichés.
- [ ] En attente client affiché.
- [ ] En intervention affiché.
- [ ] Fermés ce mois affiché.
- [ ] Délai moyen affiché.

## Toolbar

- [ ] Recherche opérationnelle.
- [ ] Filtre client opérationnel.
- [ ] Filtre chantier opérationnel.
- [ ] Filtre priorité opérationnel.
- [ ] Filtre statut opérationnel.
- [ ] Filtre intervenant opérationnel.
- [ ] Filtre date opérationnel.

## Vues

- [ ] Vue Liste visible.
- [ ] Vue Kanban visible.
- [ ] Vue Planning interventions visible.

## Liste

- [ ] Colonnes Ticket, Client, Chantier, Sujet, Priorité, Statut, Intervenant, Date ouverture, SLA, Actions visibles.
- [ ] Clic ligne ouvre drawer.

## Kanban

- [ ] Colonnes Nouveau, Qualifié, Planifié, En intervention, En attente client, Résolu, Fermé visibles.
- [ ] Empty states visibles.

## Drawer

- [ ] Tabs Détail, Historique, Photos, Messages, Intervention, Documents, Clôture visibles.
- [ ] Actions Assigner, Planifier, Message client, Clôturer désactivées clairement si non finalisées.

## Validation

- [ ] Aucun texte encodé cassé.
- [ ] Responsive desktop/tablette/mobile.
- [ ] `npm run build` passe.
