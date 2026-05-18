# Guide utilisateur - Dashboard CRM Batipro

Le CRM Batipro centralise le pilotage commercial transverse : prospects, clients, opportunités, relances, agenda, suivi devis et SAV.

## Header CRM

Le header donne accès aux actions principales :

- **Prospect** : ouvre le formulaire de création d'un prospect.
- **Opportunité** : ouvre le formulaire de création d'une affaire commerciale.
- **Devis** : oriente vers les projets, où le Quote Builder est l'unique moteur de création et d'édition de devis.
- **Agenda** : ouvre les tâches commerciales et rendez-vous.
- **Rafraîchir** : recharge les données CRM.

## Navigation

Les onglets visibles couvrent uniquement les usages CRM prioritaires :

- **Dashboard** : cockpit commercial.
- **Prospects** : suivi et qualification des nouveaux contacts.
- **Clients** : référentiel client.
- **Opportunités** : pipeline commercial.
- **Devis** : suivi transverse des devis existants.
- **Agenda** : relances, tâches et rendez-vous.
- **SAV** : tickets après chantier.

Les routes secondaires restent accessibles par URL directe si nécessaire : `/crm/contacts`, `/crm/ressources`, `/crm/bibliotheque` et `/crm/parametres`. Elles ne sont plus affichées dans la navigation CRM principale.

## KPI

- **Prospects actifs** : prospects encore à traiter ou convertir.
- **Devis en attente** : devis brouillons, envoyés ou en négociation.
- **CA signé** : montant HT des devis acceptés.
- **Taux transformation** : part des devis acceptés sur le total des devis.
- **Relances en retard** : tâches commerciales dépassées.
- **SAV ouverts** : tickets client encore non clos.

## Actions commerciales du jour

Ce bloc regroupe les actions prioritaires :

- relances en retard,
- tâches du jour,
- rendez-vous du jour,
- devis à envoyer,
- devis à relancer.

Si aucune action urgente n'existe, le dashboard affiche un état vide indiquant que le suivi commercial est à jour.

## Points de vigilance

Ce bloc signale les risques commerciaux :

- relances en retard,
- devis refusés,
- SAV ouverts,
- opportunités sans prochaine action.

Chaque carte redirige vers le module correspondant.

## Pipeline commercial

Le pipeline affiche les opportunités par étape :

- Lead,
- Qualification,
- Visite,
- Chiffrage,
- Devis envoyé,
- Négociation,
- Signature.

Chaque colonne affiche le nombre d'affaires, le montant total estimé et les premières opportunités.

## Activité récente

Ce bloc liste les derniers événements CRM disponibles :

- devis créés,
- prospects ajoutés,
- rendez-vous,
- tickets SAV.
