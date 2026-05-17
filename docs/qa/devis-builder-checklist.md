# QA - Quote Builder V1 projet

## Routes

- [ ] `/projets/:projectId/devis/nouveau` ouvre le Quote Builder V1.
- [ ] `/projets/:projectId/devis/:quoteId/edit` ouvre l'editeur devis existant.
- [ ] Le bouton `Creer devis` depuis un projet ne redirige pas vers `/crm/devis`.
- [ ] Le bouton `Creer pre-devis` depuis une visite ouvre l'editeur projet.

## Import projet / visite

- [ ] Le client ou prospect est pre-rempli.
- [ ] L'adresse projet est pre-remplie.
- [ ] La description projet est reprise.
- [ ] Une section creee en visite apparait comme section devis.
- [ ] Une tache creee en visite apparait comme ligne devis.
- [ ] Les unites `u`, `h`, `ml`, `m2`, `m3` sont reprises.
- [ ] Les quantites calculees sont reprises.
- [ ] Les notes techniques sont reprises dans le document.

## Edition devis

- [ ] Ajouter une section.
- [ ] Ajouter une sous-section.
- [ ] Ajouter une ligne.
- [ ] Supprimer une ligne.
- [ ] Reordonner des lignes avec drag & drop.
- [ ] Modifier quantite, unite, prix HT et TVA.
- [ ] Verifier le recalcul HT / TVA / TTC.
- [ ] Ajouter une ligne depuis la bibliotheque laterale.

## Sauvegarde et navigation

- [ ] Enregistrer un nouveau devis projet.
- [ ] Fermer et revenir a la fiche projet.
- [ ] Rouvrir le devis projet sans perdre les lignes.
- [ ] Enregistrer un devis existant sans erreur.

## PDF

- [ ] Export PDF minimal disponible.
- [ ] Les lignes, totaux et conditions apparaissent dans le PDF.

## Responsive

- [ ] Desktop : colonnes bibliotheque / document / totaux visibles.
- [ ] Tablette : panneaux utilisables.
- [ ] Mobile : pas de scroll horizontal bloquant.

## Build

- [ ] `npm run build` passe.
