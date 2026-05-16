# QA — Prospects CRM Batipro

## Route

- [ ] `/crm/prospects` affiche la page Prospects.
- [ ] La navigation CRM reste fonctionnelle.
- [ ] `CrmPage` continue d’orchestrer la section sans erreur.

## Affichage

- [ ] Header `Prospects` visible.
- [ ] Sous-titre visible.
- [ ] Bouton `Ajouter prospect` ouvre le formulaire.
- [ ] Bouton `Import` est désactivé clairement.
- [ ] Bouton `Opportunité` ouvre la création d’opportunité.
- [ ] Les 6 KPI contextuels s’affichent.

## Recherche et filtres

- [ ] Recherche instantanée opérationnelle.
- [ ] Filtre statut opérationnel.
- [ ] Filtre source opérationnel.
- [ ] Filtre commercial opérationnel.
- [ ] Filtre budget opérationnel.
- [ ] Filtre date création opérationnel.
- [ ] Filtre relance due opérationnel.
- [ ] Filtres rapides Tous, À relancer, Chauds, Sans suite, Convertis opérationnels.

## Vues

- [ ] Vue Liste affichée par défaut.
- [ ] Vue Kanban accessible.
- [ ] Vue Cartes accessible.
- [ ] Les données restent cohérentes entre les vues.

## Table

- [ ] Colonnes Prospect, Projet, Budget, Source, Commercial, Dernière activité, Statut, Actions visibles.
- [ ] Initiales/avatars visibles.
- [ ] Badges statut lisibles.
- [ ] Hover ligne visible.
- [ ] Clic ligne ouvre le drawer.
- [ ] Actions ligne visibles au survol sur desktop.

## Actions

- [ ] Appeler fonctionne si téléphone présent.
- [ ] Email fonctionne si email présent.
- [ ] Tâche crée une relance.
- [ ] Convertir en client fonctionne.
- [ ] Créer opportunité ouvre la modale existante.
- [ ] Créer devis déclenche la création devis existante.
- [ ] Modifier est désactivé clairement si non implémenté.
- [ ] Archiver passe le prospect en archive.

## Drawer

- [ ] Drawer s’ouvre au clic ligne/carte.
- [ ] Coordonnées affichées.
- [ ] Projet affiché.
- [ ] Budget affiché.
- [ ] Source et statut affichés.
- [ ] Notes/historique affichés.
- [ ] Fermeture drawer fonctionne.

## Empty State

- [ ] Aucun tableau vide brut.
- [ ] Empty state premium visible si aucun prospect filtré.
- [ ] CTA Ajouter un prospect fonctionne.
- [ ] CTA Importer est désactivé clairement.

## Responsive

- [ ] Mobile lisible.
- [ ] Tablette lisible.
- [ ] Tableau scroll horizontal si nécessaire.
- [ ] Kanban scroll horizontal si nécessaire.

## Validation

- [ ] Aucun texte encodé cassé.
- [ ] `npm run build` passe.
