# Roadmap de consolidation Batipro

Statut : gel des nouvelles features.

Objectif : transformer Batipro d'un assemblage V1 fonctionnel en produit coherent, vendable et maintenable.

## Regle produit

Aucune nouvelle fonctionnalite metier ne doit etre demarree avant la fin de cette consolidation.

Les travaux autorises sont :

- correction d'encodage ;
- suppression de doublons UX ;
- unification des parcours existants ;
- migration de persistance locale vers Supabase ;
- consolidation document-engine / PDF ;
- workflow email et signature sur les documents existants ;
- refonte UX des modules V1 deja presents.

Les travaux interdits pendant cette phase sont :

- nouveau module metier ;
- nouveau workflow non demande par la consolidation ;
- nouvelle logique parallele au devis, aux factures, aux achats ou aux chantiers ;
- nouvelles tables sans lien direct avec les migrations prevues.

## Sprint A - Coherence visible et parcours devis

Objectif : corriger ce que l'utilisateur voit immediatement et supprimer les ambiguities de navigation.

### A1. Encodage visible

Corriger tous les textes visibles casses :

- caractères mojibake visibles dans les libellés et messages utilisateur ;
- modules cibles : CRM, Projets, Quote Builder, Fournisseurs, Produits, Chantiers, docs utilisateur.

Critere de sortie :

- plus aucun libelle visible avec encodage casse sur les routes principales ;
- verification par recherche code et navigation manuelle.

### A2. Devis unique

Supprimer la coexistence utilisateur entre ancien CRM Devis et nouveau Quote Builder.

Decision produit :

- le nouveau Quote Builder devient l'unique experience de creation/edition devis ;
- le CRM Devis devient une vue transverse de suivi/liste, pas un editeur concurrent ;
- les creations depuis projet, CRM, client et sidebar doivent ouvrir le Quote Builder.

Critere de sortie :

- aucun bouton `Nouveau devis` ne renvoie vers l'ancien workspace CRM ;
- `/crm/devis/:id/edit` est redirige ou adapte vers le nouveau builder ;
- les anciens dialogs devis CRM ne sont plus exposes comme parcours principal.

### A3. Navigation sidebar

Nouvelle organisation cible :

- Commerce : CRM, Projets, Devis ;
- Production : Chantiers, Intervenants, Retours terrain ;
- Achats : Fournisseurs, Bons de commande, Produits ;
- Admin : Statistiques, Bibliotheque, Mon entreprise.

Critere de sortie :

- libelles coherents ;
- pas de doublon visible entre Devis CRM et Devis Projet ;
- les modules V1 restent accessibles mais clairement ranges.

## Sprint B - Persistance Supabase

Objectif : sortir les modules V1 du stockage navigateur.

Modules a migrer :

- factures ;
- bons de commande fournisseurs ;
- catalogue produits ;
- PV de reception.

Contraintes :

- migrations propres ;
- RLS par organisation/company ;
- index et FK ;
- compatibilite avec document-engine ;
- migration douce depuis localStorage si necessaire.

Critere de sortie :

- les donnees sont partagees entre sessions/utilisateurs autorises ;
- localStorage n'est plus la source principale ;
- `npm run build` OK ;
- politiques RLS testees.

## Sprint C - Documents, PDF, email, signature

Objectif : rendre les documents commercialement exploitables.

### C1. PDF premium unique

Unifier le rendu PDF via document-engine pour :

- devis ;
- factures ;
- avoirs ;
- bons de commande ;
- PV reception.

Critere de sortie :

- template premium commun ;
- sections/sous-sections/lignes/texte/signature bien rendus ;
- pagination robuste ;
- TVA et totaux fiables.

### C2. Email et signature

Remplacer les assistants d'envoi preparatoires par un vrai workflow :

- email client/fournisseur ;
- lien securise ;
- consultation document ;
- acceptation / refus ;
- signature ;
- relance.

Critere de sortie :

- statut document mis a jour apres envoi/consultation/signature ;
- historique document visible ;
- erreurs email comprehensibles.

## Sprint D - Refonte UX des modules V1

Objectif : rendre les modules deja presents vendables.

Modules prioritaires :

1. Factures.
2. Fournisseurs / bons de commande.
3. Catalogue produits.
4. Fiche chantier / Qualite / PV reception.

Critere de sortie :

- ecrans plus denses, plus lisibles ;
- actions principales visibles ;
- tables responsive ou alternatives cartes ;
- empty states propres ;
- aucun bouton mort.

## Dette connue a suivre

- Plusieurs modules utilisent encore localStorage comme persistance V1.
- `CrmPage` et `ChantierPage` restent des orchestrateurs lourds.
- Deux generations PDF coexistent encore : Quote Builder premium et document-engine generique.
- Les routes CRM secondaires existent encore en acces direct.
- Le chunk principal depasse 2 MiB ; une strategie de code splitting reste necessaire.

## Ordre d'execution recommande

1. Encodage.
2. Devis unique.
3. Sidebar.
4. Migrations Supabase.
5. PDF premium document-engine.
6. Email/signature.
7. Refonte UX modules V1.
