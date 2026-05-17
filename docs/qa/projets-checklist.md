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
- `Planifier RDV` ouvre `/crm/agenda`.
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
- Devis affiche les devis liés avec montants HT/TTC et lien d’ouverture.
- Documents affiche les catégories et documents liés.
- Activité affiche la timeline commerciale.
- SAV affiche uniquement les tickets liés au projet ou au client.

## Validation technique

- `npm run build` passe.
- Aucune route existante cassée.
- Aucun service/API modifié pour cette refonte UI de fiche projet.
- La séparation Commerce / Production est respectée.
