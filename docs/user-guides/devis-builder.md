# Guide utilisateur - Editeur devis Batipro

L'editeur devis Batipro transforme une visite de chiffrage en devis professionnel sans double saisie.

## Acces depuis un projet

Depuis une fiche projet :

- `Creer devis` ouvre `/projets/:projectId/devis/nouveau`.
- `Ouvrir devis` ouvre `/projets/:projectId/devis/:quoteId/edit`.
- `Creer pre-devis` depuis une visite de chiffrage ouvre aussi l'editeur projet.

Le devis n'est pas cree depuis le CRM. Le CRM Devis reste une vue globale de suivi.

## Donnees reprises automatiquement

Le devis reprend les donnees du projet :

- client ou prospect ;
- adresse chantier ;
- commercial si disponible ;
- description projet ;
- devis existants du projet.

Si une visite de chiffrage existe, l'editeur reprend :

- sections ;
- taches / prestations ;
- unites ;
- quantites calculees ;
- notes techniques ;
- contraintes.

## Structure du document

Le devis est organise comme un document BTP :

- sections ;
- sous-sections ;
- lignes simples ;
- ouvrages composes ;
- textes libres ;
- conditions de paiement ;
- notes de bas de page.

Chaque ligne facturable peut contenir une quantite, une unite, un prix HT, une TVA et un total HT.

## Bibliotheque

La colonne gauche permet d'inserer des elements issus de la bibliotheque Batipro dans la section active du devis.

## Totaux

La colonne droite affiche :

- total HT ;
- ventilation TVA ;
- total TTC ;
- acompte ;
- net a payer ;
- marge si les droits et donnees sont disponibles.

## Sauvegarde

Les devis existants utilisent la sauvegarde existante du module devis.

Pour un nouveau devis cree depuis un projet, le brouillon est conserve dans l'espace projet afin d'eviter la perte de saisie pendant l'edition.
