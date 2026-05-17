# QA - Module Projets

## Navigation

- `/projets` est accessible depuis la sidebar.
- `/projets/:id` ouvre une fiche projet.
- La fiche projet ouvre l'onglet Resume par defaut.
- Les onglets visibles sont : Resume, RDV / Visites, Devis, Documents, Activite, SAV.
- Preparation chantier et Chantier ne sont pas des onglets Projet.
- CRM, Devis et Chantiers restent accessibles.

## Liste projets

- Les KPI s'affichent sans erreur.
- La recherche filtre par projet, client, adresse et type.
- Le filtre statut fonctionne.
- Le filtre type projet fonctionne.
- Un projet s'ouvre depuis la table.
- L'etat vide affiche un CTA vers les prospects.

## Header fiche projet

- Le header affiche nom projet, client, adresse, statut, commercial, source, budget et echeance.
- `Modifier` renvoie vers l'espace CRM adapte.
- `Planifier RDV` ouvre `/projets/:id/rdv/nouveau`.
- `Creer devis` ou `Ouvrir devis` fonctionne selon l'existence d'un devis.
- `Relancer` ouvre l'agenda CRM.
- `Creer chantier` est disponible uniquement si un devis accepte existe.
- Si un chantier existe deja, le bouton devient `Ouvrir chantier`.

## Onglets metier

- Visites affiche les visites existantes ou un etat vide.
- Une visite existante s'ouvre via `/projets/:id/rdv/:rdvId`.
- Devis affiche les devis lies avec montants HT/TTC et lien d'ouverture.
- Documents affiche les categories et documents lies.
- Activite affiche la timeline commerciale.
- SAV affiche uniquement les tickets lies au projet ou au client.

## Fiche visite terrain

- `/projets/:id/rdv/nouveau` charge la fiche visite terrain.
- `/projets/:id/rdv/:rdvId` charge une visite existante si presente.
- La fiche n'est pas un wizard lineaire.
- Les onglets visibles sont : Informations, Besoin client, Visite terrain, Photos, Documents, Decision / suite, Compte-rendu.
- `Sauvegarder` conserve le brouillon local.
- `Planifier` cree un evenement `crm_appointments`.
- `Marquer realisee` cree un evenement `crm_appointments` avec compte-rendu.
- Apres enregistrement, retour vers `/projets/:id?tab=visits`.
- La visite apparait dans l'onglet Visites apres rechargement des donnees.
- L'agenda CRM conserve son role de vue globale car il lit `crm_appointments`.

## Validation technique

- `npm run build` passe.
- Aucune route existante cassee.
- Aucun service/API existant casse.
- La separation Commerce / Production est respectee.
