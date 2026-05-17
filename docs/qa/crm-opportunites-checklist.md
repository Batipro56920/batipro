# QA — Opportunités CRM Batipro

## Route

- [ ] `/crm/opportunites` affiche la page Opportunités.
- [ ] Les autres routes CRM restent accessibles.
- [ ] `CrmPage` continue d’orchestrer la page sans erreur.

## Header

- [ ] Badge CRM visible.
- [ ] Titre `Pipeline commercial` visible.
- [ ] Sous-titre visible.
- [ ] Bouton `Nouvelle opportunité` ouvre la modale existante.
- [ ] Bouton `Import` est désactivé clairement.
- [ ] Bouton `Filtres` est désactivé clairement ou redirige vers la toolbar.

## KPI

- [ ] Opportunités ouvertes affichées.
- [ ] CA pipeline affiché.
- [ ] CA pondéré affiché.
- [ ] Taux conversion affiché.
- [ ] Signature ce mois affiché.
- [ ] Cartes compactes et lisibles.

## Toolbar

- [ ] Recherche texte opérationnelle.
- [ ] Filtre commercial opérationnel.
- [ ] Filtre source opérationnel.
- [ ] Filtre budget opérationnel.
- [ ] Filtre date opérationnel.
- [ ] Filtre chaud/froid/gagné/perdu opérationnel.

## Pipeline

- [ ] Colonnes visibles : Lead, Qualification, Visite, Chiffrage, Devis envoyé, Négociation, Signature, Gagné, Perdu.
- [ ] Chaque colonne affiche le nombre d’affaires.
- [ ] Chaque colonne affiche le montant total.
- [ ] Chaque colonne a une hauteur minimale correcte.
- [ ] Le scroll horizontal fonctionne si nécessaire.
- [ ] Le scroll interne colonne fonctionne si beaucoup de cartes.
- [ ] Empty state `Aucune opportunité` affiché dans les colonnes vides.

## Cartes

- [ ] Client/prospect affiché.
- [ ] Projet affiché.
- [ ] Montant affiché.
- [ ] Échéance affichée.
- [ ] Commercial affiché.
- [ ] Badge priorité affiché.
- [ ] Prochaine action affichée.

## Drag & drop

- [ ] Drag démarre sur une carte.
- [ ] Drop sur une colonne appelle la mutation existante.
- [ ] L’étape est mise à jour après refresh.
- [ ] Aucun crash si drop sans carte active.

## Drawer

- [ ] Clic carte ouvre le drawer.
- [ ] Infos client/prospect affichées.
- [ ] Notes affichées.
- [ ] Activité placeholder affichée.
- [ ] Tâches/relances/devis liés indiqués comme future connexion.
- [ ] Fermeture drawer fonctionne.

## Responsive

- [ ] Desktop lisible.
- [ ] Tablette lisible.
- [ ] Mobile utilisable avec scroll horizontal.

## Validation

- [ ] Aucun texte encodé cassé.
- [ ] `npm run build` passe.
