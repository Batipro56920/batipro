# Guide utilisateur - Projets

Le module Projets est le dossier commerce / avant-production. Il relie le prospect, les visites de chiffrage, les pre-devis, les devis, puis la creation chantier apres acceptation.

## Parcours cible

Prospect -> Projet -> Visite de chiffrage -> Pre-devis -> Devis -> Acceptation -> Chantier -> SAV.

Le CRM reste un cockpit transverse. Le Projet est le dossier affaire concret.

## Fiche projet

La fiche projet contient :

- Resume.
- RDV / Visites.
- Devis.
- Documents.
- Activite.
- SAV.

La preparation chantier n'est pas geree dans Projet. Elle commence dans le module Chantiers apres acceptation d'un devis.

## Onglet RDV / Visites

L'onglet RDV / Visites est uniquement une liste de rendez-vous du projet.

Il affiche pour chaque rendez-vous :

- type de rendez-vous ;
- date et heure ;
- client ;
- adresse ;
- commercial ;
- statut ;
- actions ouvrir, modifier, dupliquer, replanifier et annuler.

Il ne contient pas de sections, prestations, metrees ou bibliotheque. Ces outils appartiennent uniquement a l'ecran metier de visite de chiffrage.

## Ecran visite de chiffrage

Le bouton `Visite de chiffrage` ouvre `/projets/:id/visites/nouveau`.

Anciennes routes conservees :

- `/projets/:id/rdv/nouveau`.
- `/projets/:id/rdv/:rdvId`.

La visite de chiffrage est un outil terrain dedie, organise en etapes :

- Informations ;
- Description projet ;
- Terrain / pre-devis ;
- Contraintes chantier ;
- Budget / decision ;
- Synthese.

L'etape Terrain / pre-devis permet de construire pendant le rendez-vous :

- sections ;
- prestations / taches ;
- unites ;
- dimensions ;
- quantites calculees ;
- notes techniques ;
- photos et documents rattaches ;
- lignes issues de la bibliotheque.

## Calculs terrain

Les quantites se calculent selon l'unite :

- `m2` : longueur x largeur.
- `m3` : longueur x largeur x hauteur.
- `ml` : longueur.
- `u` : quantite manuelle.
- `h` : nombre d'heures.

La quantite reste modifiable manuellement si le releve terrain doit etre ajuste.

## Bibliotheque

La colonne bibliotheque permet de rechercher une tache existante et de l'inserer dans le pre-devis. Les informations reprises sont :

- designation ;
- unite ;
- famille ;
- prix HT de reference si disponible ;
- description technique ou remarques.

## Mobile terrain

Sur telephone, l'interface passe en une colonne avec :

- barre haute sticky ;
- actions rapides sticky en bas ;
- cartes de sections et prestations ;
- bouton `Prendre photo` utilisant la camera mobile ;
- import de documents depuis le telephone ;
- sauvegarde locale automatique.

## Generation pre-devis et devis projet

Le bouton `Creer pre-devis` enregistre la visite comme rendez-vous de chiffrage realise, conserve le releve structure, puis ouvre l'editeur devis du projet sur `/projets/:id/devis/nouveau`.

Le devis est pre-rempli avec :

- client ou prospect lie ;
- adresse du projet ;
- description du besoin ;
- sections de la visite ;
- taches et prestations relevees ;
- unites et quantites calculees ;
- notes techniques et contraintes.

Depuis la fiche projet, le bouton `Creer devis` ouvre aussi l'editeur dedie du projet. Il ne redirige pas vers le module CRM Devis.

Le module CRM Devis reste une vue transverse pour piloter l'ensemble des devis de l'entreprise.
