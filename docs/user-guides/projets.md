# Module Projets

Le module **Projets** appartient a la partie **Commerce** de Batipro. Il sert a piloter un dossier affaire concret jusqu'au devis puis a sa conversion chantier.

## Role

Parcours cible :

Prospect -> Projet -> Visite technique -> Compte-rendu terrain -> Pre-devis / devis -> Acceptation -> Chantier -> SAV.

Le CRM reste independant pour le reporting, le pipeline global, les statistiques, les relances globales et la vue agenda.

## Liste des projets

La page `/projets` affiche les dossiers commerciaux agreges depuis les donnees existantes :

- prospects ;
- opportunites ;
- devis ;
- chantiers lies ;
- documents ;
- SAV client.

## Fiche projet

La page `/projets/:id` s'ouvre sur l'onglet **Resume**.

Navigation projet :

- Resume ;
- Visites ;
- Devis ;
- Documents ;
- Activite ;
- SAV.

Les sections Preparation chantier et Chantier ne sont pas des onglets Projet. Le chantier apparait seulement sous forme de bloc "Chantier lie" dans le Resume si un chantier existe.

## Resume

Le Resume affiche :

- KPI dossier : visites, devis, documents, taches commerciales, SAV ;
- resume client ;
- situation commerciale ;
- derniere activite ;
- devis recent ;
- chantier lie si disponible.

## Visites

L'onglet Visites liste les visites terrain liees au projet.

Le bouton `Nouvelle visite` ouvre `/projets/:id/rdv/nouveau`.

La visite n'est plus un wizard lineaire. C'est une fiche terrain organisee par onglets :

- Informations ;
- Besoin client ;
- Visite terrain ;
- Photos ;
- Documents ;
- Decision / suite ;
- Compte-rendu.

La visite enregistree est stockee dans `crm_appointments`, ce qui permet de l'afficher dans le projet et dans l'agenda CRM global.

## Devis

L'onglet Devis centralise :

- pre-devis ;
- devis final ;
- variantes ;
- statut signature ;
- relances ;
- montants HT/TTC ;
- validite.

Depuis une visite, le bouton `Creer pre-devis` renvoie vers le module Devis afin d'eviter la double saisie.

## Documents

Categories prevues :

- Photos ;
- Plans ;
- Documents client ;
- Emails ;
- Pieces devis ;
- Annexes.

## Activite

L'onglet Activite remplace l'ancien Historique. Il affiche la timeline commerciale du dossier.

## SAV

L'onglet SAV reste leger. Il affiche uniquement les tickets lies au projet ou au client, sans remplacer le module Production SAV.
