# QA — Clients CRM Batipro

## Route

- [ ] `/crm/clients` affiche la page Clients.
- [ ] Les autres routes CRM restent accessibles.
- [ ] `CrmPage` continue d’orchestrer la page sans erreur.

## Header

- [ ] Badge CRM visible.
- [ ] Titre `Clients` visible.
- [ ] Sous-titre visible.
- [ ] Bouton `Ajouter client` ouvre la modale existante.
- [ ] Bouton `Import` est désactivé clairement.
- [ ] Bouton `Fusion doublons` est désactivé clairement.

## KPI

- [ ] Clients actifs affichés.
- [ ] Nouveaux ce mois affichés.
- [ ] CA total affiché.
- [ ] Chantiers actifs affichés.
- [ ] SAV ouverts affichés.
- [ ] Factures en attente affichées.

## Toolbar

- [ ] Recherche nom/email/téléphone/société/projet opérationnelle.
- [ ] Filtre type client opérationnel.
- [ ] Filtre commercial visible et désactivé clairement si non connecté.
- [ ] Filtre statut opérationnel.
- [ ] Filtre chantier actif opérationnel.
- [ ] Filtre SAV opérationnel.
- [ ] Filtre date opérationnel.

## Vues

- [ ] Vue Liste affichée par défaut.
- [ ] Vue Cartes accessible.
- [ ] Vue Activité accessible.
- [ ] Les données restent cohérentes entre les vues.

## Liste

- [ ] Colonnes Client, Type, Contact, Commercial, Devis, Chantiers, CA, Statut, Actions visibles.
- [ ] Hover ligne visible.
- [ ] Clic ligne ouvre le drawer.
- [ ] Actions appeler/email/ouverture visibles.
- [ ] Tableau scroll horizontal si nécessaire.

## Cartes

- [ ] Cards premium affichées.
- [ ] Contact affiché.
- [ ] Chantiers, devis, SAV et factures affichés.
- [ ] CA affiché.
- [ ] Clic carte ouvre le drawer.

## Drawer

- [ ] Identité affichée.
- [ ] Commercial affiché.
- [ ] Devis affichés.
- [ ] Chantiers affichés.
- [ ] Facturation affichée.
- [ ] SAV affiché.
- [ ] Documents affichés.
- [ ] Historique affiché.
- [ ] Notes affichées.
- [ ] Fermeture drawer fonctionne.

## Empty State

- [ ] Aucun tableau vide brut.
- [ ] Empty state premium visible si aucun client filtré.
- [ ] CTA Ajouter client fonctionne.
- [ ] CTA Importer est désactivé clairement.

## Responsive

- [ ] Desktop lisible.
- [ ] Tablette lisible.
- [ ] Mobile utilisable avec scroll horizontal.

## Validation

- [ ] Aucun texte encodé cassé.
- [ ] `npm run build` passe.
