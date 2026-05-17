# Quote Builder Batipro V1

Le POC interne devient la base officielle du moteur devis Batipro.

## Decision technique

| Piste | Decision |
| --- | --- |
| OpenConstructionERP | Reference fonctionnelle utile pour le modele BOQ/estimate. Pas d'integration directe. |
| Joyfill Invoice Builder | Non retenu comme coeur devis : trop oriente document/formulaire externe. |
| Moteur interne Batipro | Retenu pour la V1 : controle metier complet, integration Projet -> Visite -> Devis, persistance Batipro. |

## Architecture

Module officiel :

- `src/features/quotes/builder/`

Composants principaux :

- `QuoteBuilderWorkspace.tsx`
- `quoteBuilderStore.ts`
- `quoteBuilderRepository.ts`
- `quoteBuilderModel.ts`
- `quoteBuilderCalculations.ts`
- `quoteBuilderPdf.ts`
- `quoteBuilderLibrary.ts`
- `types.ts`

## Route projet

- `/projets/:projectId/devis/nouveau`
- `/projets/:projectId/devis/:quoteId/edit`

La creation depuis Projet ne redirige pas vers CRM Devis.

## Capacites V1

- modele `QuoteBuilderQuote` ;
- sections ;
- sous-sections ;
- lignes ;
- import depuis visite de chiffrage ;
- edition inline ;
- suppression ;
- drag & drop ;
- bibliotheque laterale ;
- calculs `decimal.js` ;
- sauvegarde via repository ;
- panneau totaux ;
- conditions de paiement ;
- mentions legales ;
- notes de bas de page ;
- PDF minimal ;
- affichage mobile en cartes.

## Hors scope V1

- ouvrages composes avances ;
- signature client ;
- envoi email ;
- portail client ;
- templates devis complets ;
- gestion avancee Batiprix/Batichiffrage.
