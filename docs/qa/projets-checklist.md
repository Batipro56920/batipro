# QA - Projets

## Routes

- [ ] `/projets` affiche la liste projets.
- [ ] `/projets/:id` ouvre le resume projet.
- [ ] `/projets/:id/visites/nouveau` ouvre une nouvelle visite de chiffrage.
- [ ] `/projets/:id/visites/:visitId` ouvre une visite existante.
- [ ] `/projets/:id/rdv/nouveau` reste compatible.
- [ ] `/projets/:id/rdv/:rdvId` reste compatible.

## Fiche projet

- [ ] Les onglets visibles sont Resume, RDV / Visites, Devis, Documents, Activite, SAV.
- [ ] Le chantier apparait uniquement comme lien si deja cree.
- [ ] La preparation chantier n'apparait pas comme section projet.
- [ ] Le bouton `Visite de chiffrage` ne redirige pas vers CRM Agenda.

## Visite de chiffrage

- [ ] La page affiche les informations RDV.
- [ ] Une section peut etre ajoutee.
- [ ] Une tache manuelle peut etre ajoutee.
- [ ] Une note peut etre ajoutee.
- [ ] Une tache peut etre inseree depuis la bibliotheque.
- [ ] Unite `m2` calcule longueur x largeur.
- [ ] Unite `m3` calcule longueur x largeur x hauteur.
- [ ] Unite `ml` calcule longueur.
- [ ] Unite `u` accepte une quantite manuelle.
- [ ] Unite `h` accepte un nombre d'heures.
- [ ] La quantite calculee peut etre modifiee manuellement.
- [ ] Une note technique peut etre ajoutee sur une ligne.
- [ ] Une photo peut etre rattachee a une ligne ou une section.
- [ ] Un document peut etre importe.
- [ ] Le resume affiche sections, taches, lignes bibliotheque et lignes a chiffrer.
- [ ] `Creer pre-devis` enregistre la visite et ouvre les devis.

## Mobile terrain

- [ ] Sur telephone, l'interface est en une colonne.
- [ ] Les actions rapides restent visibles en bas.
- [ ] Aucun tableau large ni scroll horizontal.
- [ ] `Prendre photo` utilise `input type=file accept=image/* capture=environment`.
- [ ] Import galerie/document fonctionne.
- [ ] Les images s'affichent en miniatures.
- [ ] Le brouillon est sauvegarde localement et repris plus tard.

## Non-regression

- [ ] CRM Agenda reste disponible comme vue globale.
- [ ] Le module Devis existant n'est pas casse.
- [ ] Les services/API existants ne sont pas modifies hors creation d'evenement.
- [ ] `npm run build` passe.
