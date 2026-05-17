# Guide utilisateur - Fiche chantier

La fiche chantier est organisée en sous-pages métier. L'URL `/chantiers/:id` reste le cockpit par défaut.

## Routes

- `/chantiers/:id` : Cockpit chantier.
- `/chantiers/:id/preparation` : Préparation.
- `/chantiers/:id/execution` : Exécution.
- `/chantiers/:id/financier` : Financier.
- `/chantiers/:id/qualite-sav` : Qualité / SAV.
- `/chantiers/:id/crm` : Continuité commerciale.
- `/chantiers/:id/historique` : Historique.

## Header commun

Le header reste visible sur toutes les sous-pages. Il affiche le chantier, le client, l'adresse, le statut, les dates, l'avancement et les alertes critiques.

Les actions rapides permettent d'accéder aux actions principales sans chercher dans les modules :

- modifier,
- ajouter une tâche,
- ajouter un intervenant,
- ajouter un document,
- ouvrir le menu actions.

## Navigation principale

La navigation principale sépare les rôles métier :

- **Cockpit** : vue de pilotage global.
- **Préparation** : intervenants, approvisionnement, matériel, documents, consignes et localisation.
- **Exécution** : tâches, planning, temps, photos, journal, messagerie.
- **Financier** : budget, achats, imprévus, rapports.
- **Qualité / SAV** : réserves, visites, DOE et SAV.
- **CRM** : client, devis d'origine, opportunité, documents commerciaux et échanges.
- **Historique** : journal complet et activité.

## Permissions

Les permissions existantes continuent de masquer les modules non autorisés. La navigation principale reste visible uniquement si au moins une section autorisée existe.

## Notes produit

Certaines sous-sections de synthèse réutilisent encore le cockpit existant pour éviter de dupliquer la logique métier. Les panneaux détaillés restent ceux de l'ancienne fiche chantier, mais ils sont maintenant rangés dans des routes plus lisibles.

