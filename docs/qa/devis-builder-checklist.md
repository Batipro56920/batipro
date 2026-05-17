# QA - Editeur devis projet

## Routes

- [ ] `/projets/:projectId/devis/nouveau` ouvre l'editeur devis.
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
- [ ] Ajouter une fourniture.
- [ ] Ajouter une main d'oeuvre.
- [ ] Ajouter un ouvrage.
- [ ] Ajouter un texte libre.
- [ ] Modifier quantite, unite, prix HT et TVA.
- [ ] Verifier le recalcul HT / TVA / TTC.
- [ ] Inserer une ligne depuis la bibliotheque.

## Sauvegarde et navigation

- [ ] Enregistrer un nouveau brouillon projet.
- [ ] Fermer et revenir a la fiche projet.
- [ ] Rouvrir le devis projet sans perdre les lignes.
- [ ] Enregistrer un devis existant sans erreur.

## Preview / PDF

- [ ] Basculer en previsualisation.
- [ ] Les notes internes ne polluent pas le rendu client si option masque active.
- [ ] Les conditions de paiement et mentions apparaissent.

## Responsive

- [ ] Desktop : colonnes bibliotheque / document / totaux visibles.
- [ ] Tablette : panneaux utilisables.
- [ ] Mobile : pas de scroll horizontal bloquant.

## Build

- [ ] `npm run build` passe.
