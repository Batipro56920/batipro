# Batipro Document Engine

Objectif : créer un socle unique pour les documents métier Batipro afin d'éviter de maintenir plusieurs éditeurs indépendants.

## Documents couverts

- Devis
- Factures
- Avoirs
- Bons de commande
- PV de réception

## Socle créé

- Modèle commun `BusinessDocument`.
- Noeuds hiérarchiques : section, sous-section, ligne, ouvrage composite, texte, saut de page, signature.
- Calculs financiers avec `decimal.js` : HT, TVA, TTC, acompte, reste, marge, ventilation TVA.
- Numérotation hiérarchique.
- Validation Zod.
- Store de brouillon local.
- Preview document.
- Carte totaux.
- Assistant d'envoi réutilisable.
- Générateur PDF minimal commun.

## Règle d'architecture

Les modules métier ne doivent plus recréer leur propre moteur documentaire.

Chaque module doit fournir :

- son type métier ;
- ses statuts ;
- ses règles de transformation ;
- ses écrans spécifiques ;
- ses permissions.

Le rendu document, les lignes, les totaux, la preview, le PDF, l'envoi et la signature doivent passer par le moteur commun.

## Prochaines migrations

1. Adapter le Quote Builder pour consommer progressivement les types du document engine.
2. Créer le module facturation sur ce socle.
3. Ajouter l'onglet Rentabilité projet.
4. Créer les bons de commande fournisseurs.
5. Créer le PV de réception chantier.

## Hors périmètre de cette étape

- Pas de migration du devis existant.
- Pas de changement de routes.
- Pas de modification Supabase.
- Pas d'envoi email réel.
- Pas de signature électronique backend.
