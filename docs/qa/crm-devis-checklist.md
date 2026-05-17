# QA — Devis CRM Batipro

## Route

- [ ] `/crm/devis` affiche la page Devis.
- [ ] Les autres routes CRM restent accessibles.
- [ ] `CrmPage` continue d’orchestrer la page sans erreur.

## Header

- [ ] Badge CRM visible.
- [ ] Titre `Devis` visible.
- [ ] Sous-titre visible.
- [ ] Bouton `Nouveau devis` crée un devis brouillon et ouvre le workspace.
- [ ] Bouton `Import` est désactivé clairement.
- [ ] Bouton `Modèles` est désactivé clairement.

## KPI

- [ ] Brouillons affichés.
- [ ] Envoyés affichés.
- [ ] Relances affichées.
- [ ] En attente signature affiché.
- [ ] Acceptés affichés.
- [ ] CA devis affiché.

## Toolbar

- [ ] Recherche opérationnelle.
- [ ] Filtre statut opérationnel.
- [ ] Filtre commercial visible et désactivé clairement si non connecté.
- [ ] Filtre client opérationnel.
- [ ] Filtre période opérationnel.
- [ ] Filtre montant opérationnel.

## Table

- [ ] Colonnes N°, Client, Projet, Montant, Validité, Statut, Signature, Commercial, Actions visibles.
- [ ] Status chips lisibles.
- [ ] Libellés techniques mappés en libellés business.
- [ ] Hover ligne visible.
- [ ] Clic ligne ouvre le drawer.
- [ ] Table scroll horizontal si nécessaire.

## Actions

- [ ] Éditer ouvre `/crm/devis/:id/edit`.
- [ ] Envoyer modifie le statut.
- [ ] Relancer modifie le statut.
- [ ] PDF déclenche la génération PDF existante.
- [ ] Accepter modifie le statut.
- [ ] Refuser modifie le statut.
- [ ] Transformer chantier appelle l’action existante.
- [ ] Dupliquer est désactivé clairement si non implémenté.
- [ ] Supprimer est désactivé clairement si non sécurisé.

## Drawer

- [ ] Drawer s’ouvre au clic ligne.
- [ ] Aperçu financier affiché.
- [ ] Client affiché.
- [ ] Projet affiché.
- [ ] Signature affichée.
- [ ] Historique affiché ou placeholder clair.
- [ ] Actions principales fonctionnelles.
- [ ] Fermeture drawer fonctionne.

## Empty State

- [ ] Aucun tableau vide brut.
- [ ] Empty state premium visible si aucun devis filtré.
- [ ] CTA Nouveau devis fonctionne.
- [ ] CTA Importer est désactivé clairement.

## Responsive

- [ ] Desktop lisible.
- [ ] Tablette lisible.
- [ ] Mobile utilisable avec scroll horizontal.

## Validation

- [ ] Aucun texte encodé cassé.
- [ ] `npm run build` passe.
