# Guide utilisateur - Fiche chantier

La fiche chantier est organisée en 5 grandes pages métier. L'objectif est de limiter les clics et d'éviter les doublons entre cockpit, synthèse, journal et historique.

## Routes

- `/chantiers/:id` : Vue d'ensemble.
- `/chantiers/:id/preparation` : Préparation.
- `/chantiers/:id/production` : Production.
- `/chantiers/:id/financier` : Financier.
- `/chantiers/:id/qualite-cloture` : Qualité / Clôture.

Les anciennes routes restent compatibles :

- `/chantiers/:id/execution` redirige vers Production.
- `/chantiers/:id/qualite-sav` redirige vers Qualité / Clôture.
- `/chantiers/:id/crm` redirige vers Vue d'ensemble.
- `/chantiers/:id/historique` redirige vers Vue d'ensemble.

## Vue d'ensemble

La vue d'ensemble regroupe les informations chantier, l'avancement, les alertes, les tâches urgentes, les jalons, le résumé budget, l'équipe, une continuité commerciale courte et l'activité récente.

## Préparation

La préparation regroupe la localisation, les intervenants prévus, les documents de départ, les consignes, le matériel, l'approvisionnement et les validations avant démarrage.

## Production

La production regroupe les tâches, le planning, les temps, les photos, la messagerie, les réserves ouvertes et le journal chantier intégré.

## Financier

Le financier regroupe le budget, les achats, les commandes, les imprévus / travaux supplémentaires, les devis / factures liés, la marge et les rapports financiers.

## Qualité / Clôture

Qualité / Clôture regroupe les réserves, les visites, le DOE, la conformité, le SAV et la clôture chantier.

## Permissions

Les permissions existantes continuent de masquer les sections non autorisées. Les conducteurs voient les pages opérationnelles, les commerciaux disposent de la vue d'ensemble avec le bloc CRM, et le financier reste soumis aux droits existants.

