# Module Projets

Le module **Projets** appartient à la partie **Commerce** de Batipro. Il sert à gérer le dossier commercial avant la production chantier.

## Rôle

Un projet suit le parcours :

Lead entrant -> Prospect -> Projet -> Qualification -> RDV / visite -> Devis -> Acceptation -> Chantier.

Le CRM reste un cockpit transverse. Le chantier reste dans la partie Production.

## Liste des projets

La page `/projets` affiche les dossiers commerciaux agrégés depuis les données existantes :

- prospects ;
- opportunités ;
- devis ;
- chantiers liés ;
- documents ;
- SAV client.

Les KPI donnent une lecture rapide des projets actifs, devis en attente, relances, projets acceptés, projets perdus et CA pipeline.

## Fiche projet

La page `/projets/:id` s’ouvre sur l’onglet **Résumé**.

Navigation projet :

- Résumé ;
- RDV / Visites ;
- Devis ;
- Documents ;
- Activité ;
- SAV.

Les sections **Préparation chantier**, **Chantier** et **Historique** ne sont plus des sections principales. Le chantier apparaît seulement sous forme de petit bloc “Chantier lié” dans le Résumé si un chantier existe.

## Résumé

Le Résumé affiche :

- informations projet ;
- client, adresse, commercial, source, budget et échéance ;
- KPI dossier : RDV, devis, montant devis, documents, relances ouvertes, SAV ;
- qualification rapide ;
- prochaines actions ;
- devis récent ;
- documents récents ;
- chantier lié si disponible.

## RDV / Visites

L’onglet sert à préparer les visites commerciales et techniques :

- liste des RDV ;
- bouton de planification ;
- compte-rendu ;
- checklist visite ;
- photos ;
- métrés ;
- contraintes techniques ;
- accès et stationnement ;
- décisions prises ;
- actions post-RDV.

## Devis

L’onglet Devis centralise :

- pré-devis ;
- devis final ;
- variantes ;
- statut signature ;
- relances ;
- montants HT/TTC ;
- validité.

Si un devis est accepté, l’action “Créer chantier” devient disponible dans le header projet.

## Documents

Catégories prévues :

- Photos ;
- Plans ;
- Documents client ;
- Emails ;
- Pièces devis ;
- Annexes.

## Activité

L’onglet Activité remplace l’ancien Historique. Il affiche la timeline commerciale : création prospect, projet, RDV, devis, relances, acceptation ou création chantier.

## SAV

L’onglet SAV reste léger. Il affiche uniquement les tickets liés au projet ou au client, sans remplacer le module Production SAV.
