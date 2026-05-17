# QA - Fiche chantier

## Routes

- [ ] `/chantiers/:id` affiche le cockpit.
- [ ] `/chantiers/:id/preparation` affiche la sous-page Préparation.
- [ ] `/chantiers/:id/execution` affiche la sous-page Exécution.
- [ ] `/chantiers/:id/financier` affiche la sous-page Financier.
- [ ] `/chantiers/:id/qualite-sav` affiche la sous-page Qualité / SAV.
- [ ] `/chantiers/:id/crm` affiche la sous-page CRM.
- [ ] `/chantiers/:id/historique` affiche la sous-page Historique.

## Header

- [ ] Le header reste visible sur chaque sous-page.
- [ ] Le nom chantier est visible.
- [ ] Le client et l'adresse sont visibles.
- [ ] Le statut est visible.
- [ ] Les dates début/fin sont visibles.
- [ ] L'avancement est visible.
- [ ] Les alertes critiques sont visibles.
- [ ] Le breadcrumb affiche `Chantiers > Nom chantier > Section`.

## Navigation

- [ ] La navigation principale utilise de vrais liens React Router.
- [ ] Les entrées principales sont Cockpit, Préparation, Exécution, Financier, Qualité / SAV, CRM, Historique.
- [ ] La sous-navigation change selon la section.
- [ ] Il n'y a plus de gros blocs Préparer / Exécuter / Contrôler / Piloter.
- [ ] Les permissions existantes masquent les sections non autorisées.

## Actions

- [ ] Modifier reste accessible.
- [ ] Ajouter tâche ouvre le flux existant.
- [ ] Ajouter intervenant mène à la section Intervenants.
- [ ] Ajouter document mène à la section Documents.
- [ ] Le menu actions conserve terminer, archiver, annuler, supprimer.

## Non-régression

- [ ] Les tâches restent accessibles.
- [ ] Le planning reste accessible.
- [ ] Les temps restent accessibles.
- [ ] Les intervenants restent accessibles.
- [ ] Les documents restent accessibles.
- [ ] Les réserves restent accessibles.
- [ ] Le budget reste accessible.
- [ ] Le CRM chantier reste accessible.
- [ ] Le journal/historique reste accessible.
- [ ] Responsive desktop/tablette/mobile correct.
- [ ] `npm run build` passe.

