# QA - Module Projets

## Navigation

- `/projets` est accessible depuis la sidebar.
- `/projets/:id` ouvre une fiche projet.
- CRM, Devis et Chantiers restent accessibles.
- Les permissions CRM continuent de protéger le module.

## Liste projets

- Les KPI s’affichent sans erreur.
- La recherche filtre par projet, client, adresse, type.
- Le filtre statut fonctionne.
- Le filtre type projet fonctionne.
- Un projet s’ouvre depuis la table.
- L’état vide affiche un CTA vers les prospects.

## Fiche projet

- Le header affiche nom, client, adresse, statut, montant, dates et commercial.
- `Planifier RDV` ouvre `/crm/agenda`.
- `Ouvrir devis` ouvre le devis lié si disponible.
- `Créer devis` renvoie vers `/crm/devis` si aucun devis n’est lié.
- `Ouvrir chantier` ouvre le chantier lié si disponible.
- `Convertir chantier` est désactivé clairement sans chantier lié.

## Sections

- Vue d’ensemble affiche les coordonnées et KPI dossier.
- RDV / Visites affiche les rendez-vous existants ou un état vide.
- Devis affiche les devis liés.
- Documents affiche les documents liés ou un état vide.
- Préparation chantier est visible mais contextualisée avant acceptation.
- Chantier affiche le lien chantier si présent.
- SAV affiche les tickets liés.
- Historique affiche une timeline.

## Validation technique

- `npm run build` passe.
- Aucun bouton mort ajouté.
- Aucune route existante cassée.
- Aucune table Supabase nouvelle requise pour cette première couche project-centric.
