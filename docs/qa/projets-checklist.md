# QA - Module Projets

## Navigation

- `/projets` est accessible depuis la sidebar.
- `/projets/:id` ouvre une fiche projet.
- La fiche projet ouvre l’onglet Résumé par défaut.
- Les onglets visibles sont : Résumé, RDV / Visites, Devis, Documents, Activité, SAV.
- Les anciennes sections principales Préparation chantier, Chantier et Historique séparé ne sont plus affichées.
- CRM, Devis et Chantiers restent accessibles.

## Liste projets

- Les KPI s’affichent sans erreur.
- La recherche filtre par projet, client, adresse et type.
- Le filtre statut fonctionne.
- Le filtre type projet fonctionne.
- Un projet s’ouvre depuis la table.
- L’état vide affiche un CTA vers les prospects.

## Header fiche projet

- Le header affiche nom projet, client, adresse, statut, commercial, source, budget et échéance.
- `Modifier` renvoie vers l’espace CRM adapté.
- `Planifier RDV` ouvre `/projets/:id/rdv/nouveau`.
- `Créer devis` ou `Ouvrir devis` fonctionne selon l’existence d’un devis.
- `Relancer` ouvre `/crm/agenda`.
- `Créer chantier` est disponible uniquement si un devis accepté existe.
- Si un chantier existe déjà, le bouton devient `Ouvrir chantier`.
- `Gagné` et `Perdu` sont désactivés tant que les mutations projet persistées ne sont pas branchées.

## Onglet Résumé

- Informations projet visibles.
- Qualification rapide visible.
- Prochaines actions visibles.
- Dernière activité visible.
- Devis récent visible si disponible.
- Documents récents visibles si disponibles.
- Chantier lié affiché uniquement si un chantier existe.

## Onglets métier

- RDV / Visites affiche les rendez-vous existants ou un état vide.
- RDV / Visites permet d’ouvrir un RDV existant via `/projets/:id/rdv/:rdvId`.
- Devis affiche les devis liés avec montants HT/TTC et lien d’ouverture.
- Documents affiche les catégories et documents liés.
- Activité affiche la timeline commerciale.
- SAV affiche uniquement les tickets liés au projet ou au client.

## Wizard RDV projet

- `/projets/:id/rdv/nouveau` charge le wizard.
- `/projets/:id/rdv/:rdvId` charge le RDV existant si présent.
- Les 7 étapes sont accessibles : Renseignements, Description projet, Tâches à vérifier, Contraintes, Photos & documents, Budget & décision, Synthèse.
- Le bouton précédent/suivant fonctionne.
- La sauvegarde brouillon reste dans le projet et ne redirige pas vers CRM.
- `Marquer planifié` crée un événement `crm_appointments`.
- `Enregistrer RDV` crée un événement `crm_appointments` avec compte-rendu structuré.
- Après enregistrement, retour vers `/projets/:id?tab=visits`.
- Le RDV apparaît dans l’onglet RDV / Visites après rechargement des données.
- L’agenda CRM conserve son rôle de vue globale car il lit `crm_appointments`.

## Validation technique

- `npm run build` passe.
- Aucune route existante cassée.
- Aucun service/API modifié pour cette refonte UI de fiche projet.
- La séparation Commerce / Production est respectée.
