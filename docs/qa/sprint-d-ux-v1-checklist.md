# Sprint D - Refonte UX produit

Date : 2026-05-19

## Périmètre traité

- Quote Builder
- Rentabilité projet
- Cockpit chantier
- Factures
- Bons de commande fournisseurs
- Catalogue produits
- Fournisseurs
- Chantier / PV réception

## Contraintes respectées

- Pas de nouvelle feature majeure.
- Pas de modification infrastructure Supabase.
- Pas de refonte service/API.
- Amélioration UX uniquement : lisibilité, filtres, actions rapides, états vides, libellés.

## Quote Builder

À valider :

- Topbar premium avec état de sauvegarde visible.
- CTA hiérarchisés : Enregistrer, Envoyer, Dupliquer, Télécharger.
- Transformation en facture visible mais désactivée tant que le workflow n'est pas connecté.
- Mode édition et prévisualisation accessibles.
- Preview avec zoom, navigation pages, ouverture PDF, téléchargement et partage.
- Bibliothèque repliable, recherche et insertion inchangées.
- Panneau options fonctionnel.
- Mobile en cartes conservé.

## Rentabilité projet

À valider :

- KPI dirigeant : vendu, facturé, encaissé, achats, main d'œuvre, marge brute, taux de marge.
- Barres de lecture : facturation, encaissement, achats, marge.
- Alertes : marge faible, marge négative, achats supérieurs au vendu, encaissement, facturation incomplète.
- Mode données lisible : réel, mixte ou estimation V1.
- Données mock/locales conservées si le backend n'est pas prêt.

## Cockpit chantier

À valider :

- Bloc "Cockpit terrain" visible sur la page cockpit.
- Accès rapides Production, Documents, PV / Réserves.
- Cartes statut, planning, intervenants, réserves, documents, PV réception.
- Aucun onglet existant supprimé.
- Navigation chantier inchangée.

## Factures

À valider :

- Header avec actions claires.
- Recherche par numéro, client, chantier.
- Filtres statut et type.
- Stat cards lisibles.
- Liste latérale filtrée.
- Empty state si aucun résultat.
- Création acompte/intermédiaire/finale/avoir toujours fonctionnelle.

## Bons de commande

À valider :

- Header achats fournisseurs.
- Actions rafraîchir et nouveau bon de commande.
- Recherche commande/fournisseur/référence.
- Filtres statut et fournisseur.
- Empty state avec CTA.
- Ouverture éditeur inchangée.

## Catalogue produits

À valider :

- Header catalogue.
- Actions rafraîchir et nouveau produit.
- KPI produits/fournisseurs/documents/prix achat moyen.
- Recherche et filtres existants conservés.
- Empty state premium avec CTA.
- Correction des libellés visibles.

## Fournisseurs

À valider :

- Header premium Achats.
- Onglets Fournisseurs / Bons de commande conservés.
- KPI fournisseurs.
- Recherche plus lisible.
- Empty state avec CTA.
- CRUD fournisseur inchangé.

## Chantier / PV réception

À valider :

- Libellés corrigés.
- Actions prévisualiser, PDF, envoyer, enregistrer.
- Réserves importables depuis chantier.
- Réserves ajout/modification/suppression.
- Signature client/entreprise.
- PDF et preview document-engine inchangés.

## Build

- `npm run build` : à relancer après cette passe.
- Warning Vite gros chunks : connu, traité dans Stream E.
