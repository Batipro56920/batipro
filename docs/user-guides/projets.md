# Module Projets

Le module **Projets** devient le dossier métier central avant-production de Batipro.

## Rôle

Un projet regroupe le parcours complet :

Lead entrant -> Prospect -> Projet -> Qualification -> RDV / visite -> Devis -> Acceptation -> Préparation chantier -> Chantier -> Clôture -> SAV.

Le CRM reste un cockpit transverse pour le pilotage commercial global. Le module Projets sert à suivre chaque dossier affaire individuellement.

## Liste des projets

La page `/projets` affiche :

- les projets actifs ;
- les devis en attente ;
- les projets à relancer ;
- les projets acceptés ;
- les projets perdus ;
- le CA pipeline projet.

Les projets sont construits à partir des données CRM existantes : prospects, opportunités, devis, chantiers et SAV. Cela évite la double saisie et prépare la migration vers un modèle projet dédié.

## Fiche projet

La fiche `/projets/:id` contient :

- Vue d’ensemble : client, coordonnées, adresse, type projet, source, budget, prochaine action.
- RDV / Visites : rendez-vous, compte-rendu, qualification technique.
- Devis : devis liés au dossier.
- Documents : pièces client, plans, photos, devis et annexes.
- Préparation chantier : visible après acceptation.
- Chantier : lien vers le chantier créé.
- SAV : tickets liés au chantier ou au client.
- Historique : timeline commerciale et opérationnelle.

## Actions

- `Depuis prospect` ouvre le portefeuille prospects pour créer ou qualifier un lead.
- `Nouveau devis` ouvre la vue devis CRM.
- `Planifier RDV` ouvre l’agenda commercial.
- `Ouvrir devis` ouvre le workspace du devis lié.
- `Ouvrir chantier` ouvre le chantier lié si disponible.
- `Convertir chantier` reste désactivé tant qu’aucun devis accepté n’a généré de chantier.

## Évolution prévue

La base actuelle réutilise les données CRM existantes. La prochaine étape structurante consiste à créer des tables dédiées aux projets et aux visites métier si la persistance complète des comptes-rendus de visite doit être séparée de l’agenda CRM.
