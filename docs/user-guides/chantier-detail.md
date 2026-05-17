# Guide utilisateur - Fiche chantier

La fiche chantier est le cockpit production. Elle sert a piloter l'execution terrain apres acceptation du devis, sans remplacer le CRM ni le module Projet.

## Navigation principale

- `/chantiers/:id` : Cockpit.
- `/chantiers/:id/preparation` : Preparation.
- `/chantiers/:id/execution` : Execution.
- `/chantiers/:id/financier` : Financier.
- `/chantiers/:id/qualite` : Qualite.
- `/chantiers/:id/documents` : Documents.
- `/chantiers/:id/equipe` : Equipe.
- `/chantiers/:id/sav` : SAV.
- `/chantiers/:id/historique` : Historique.

Routes conservees pour compatibilite :

- `/chantiers/:id/production` redirige vers `/execution`.
- `/chantiers/:id/qualite-cloture` redirige vers `/qualite`.
- `/chantiers/:id/qualite-sav` redirige vers `/qualite`.
- `/chantiers/:id/crm` redirige vers le cockpit.

## Cockpit

Le cockpit est l'unique synthese chantier. Il affiche les informations principales, l'avancement, les KPI operationnels, les alertes utiles, le resume des taches et l'activite recente.

## Preparation

La preparation sert a rendre le chantier lancable : checklist, arborescence des zones, intervenants prevus, consignes, materiel et approvisionnement critique.

## Execution

L'execution regroupe le travail quotidien : taches, planning, temps, photos terrain, messagerie, notes et reserves ouvertes.

## Financier

Le financier suit uniquement la production : budget, achats, commandes, imprevus, travaux supplementaires, marge et rapports.

## Qualite

La qualite couvre les reserves, les visites, les controles et le DOE. Le SAV operationnel est separe dans son onglet dedie.

## Documents

Documents centralise tous les fichiers du chantier : plans, devis, avenants, photos, PV, DOE, documents client et pieces SAV.

## Equipe

Equipe donne une vue operationnelle des intervenants affectes au chantier et des affectations utiles a la production.

## SAV

SAV suit les tickets post-production rattaches au chantier. La vue CRM globale reste disponible dans le module CRM.

## Historique

Historique remplace les anciens doublons journal/historique. Il affiche la timeline d'audit du chantier.

## Permissions

Les permissions existantes continuent de masquer les sections non autorisees. Le dirigeant voit tout, le conducteur pilote la production, le commercial reste en lecture limitee, l'intervenant utilise le portail simplifie, et l'administratif accede aux documents et au suivi autorise.
