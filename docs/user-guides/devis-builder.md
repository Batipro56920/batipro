# Guide utilisateur - Quote Builder V1 Batipro

Le Quote Builder V1 devient la base officielle du futur moteur devis Batipro. L'ancien workspace devis n'est plus utilise pour creer un devis depuis un projet.

## Acces depuis un projet

Depuis une fiche projet :

- `Creer devis` ouvre `/projets/:projectId/devis/nouveau`.
- `Ouvrir devis` ouvre `/projets/:projectId/devis/:quoteId/edit`.
- `Creer pre-devis` depuis une visite de chiffrage ouvre aussi l'editeur projet.

Le devis n'est pas cree depuis le CRM. Le CRM Devis reste une vue globale de suivi.

## V1 actuelle

La V1 couvre :

- structure section > sous-section > ligne ;
- edition quantite, unite, prix HT, TVA ;
- calcul total HT / TVA / TTC avec `decimal.js` ;
- table editable TanStack Table ;
- drag & drop avec dnd-kit ;
- import depuis visite de chiffrage ;
- bibliotheque laterale ;
- panneau totaux ;
- conditions de paiement, mentions et notes ;
- sauvegarde via couche repository ;
- export PDF minimal ;
- version mobile en cartes.

La V1 n'est pas encore le module final : ouvrages composes avances, signature, envoi client et templates complets restent a construire sur ce modele.

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
