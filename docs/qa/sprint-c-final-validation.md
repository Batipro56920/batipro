# Sprint C - Validation finale

Date : 2026-05-19

## Décision produit

### Email client

Décision V1 : simulation assumée avec fallback `mailto:`.

Raison :

- Aucun provider email transactionnel n'est configuré dans le projet.
- Brancher un envoi réel sans provider, domaine d'envoi, SPF/DKIM et logs d'envoi créerait un faux sentiment de production-ready.

Prochaine étape production :

- Choisir un provider email transactionnel.
- Créer une Edge Function Supabase `send-business-document`.
- Persister les envois et erreurs dans une table dédiée.
- Ajouter tracking : envoyé, ouvert, relancé.

### Signature électronique

Décision V1 : acceptation/refus horodaté simple.

Raison :

- Suffisant pour valider le workflow client V1.
- La signature électronique avancée doit rester une étape séparée avec provider spécialisé.

Preuve V1 attendue :

- token client sécurisé ;
- date/heure ;
- nom signataire ;
- email ;
- décision : accepté, refusé, modification demandée ;
- commentaire client ;
- user-agent/IP si disponible côté backend.

## QA visuelle PDF

Documents à valider manuellement avec les fixtures métier :

- Devis long avec sections, sous-sections, lignes, TVA multiples, conditions, signature.
- Facture d'acompte.
- Facture finale.
- Avoir.
- Bon de commande fournisseur.
- PV réception avec réserves.

Résultat attendu :

- Header premium.
- Cartes entreprise/destinataire lisibles.
- Sections et sous-sections visibles.
- Lignes non coupées de manière critique.
- Totaux HT/TVA/TTC et net à payer.
- Conditions et mentions en blocs dédiés.
- Signature sur les documents concernés.
- Footer paginé.

Validation locale :

- `npm run build` : OK.

## QA preview client

À vérifier dans les modules qui appellent `DocumentPreview` :

- rendu desktop ;
- rendu mobile ;
- bouton télécharger ;
- bouton envoyer ;
- cohérence libellés par type de document ;
- absence de champs éditables dans le rendu client.

Limite V1 :

- Les boutons accepter/refuser/demander modification sont cadrés dans le workflow client, mais le portail public persistant doit être branché avant production.

## QA Supabase réelle

Commande testée :

- `supabase migration list`

Résultat :

- Échec authentification Postgres.
- Cause : `SUPABASE_DB_PASSWORD` est présent mais refusé par le serveur distant.

Action nécessaire :

- Remettre à jour `SUPABASE_DB_PASSWORD` avec le mot de passe Postgres actuel du projet Supabase.
- Rejouer :
  - `supabase migration list`
  - `supabase db push`
  - tests CRUD sur `invoices`, `purchase_orders`, `product_catalog_items`, `reception_reports`
  - tests RLS utilisateur connecté/anonyme.

## Critère de sortie Sprint C

Validé côté code :

- document-engine centralise les templates ;
- PDF premium commun ;
- preview premium ;
- assistant d'envoi client réutilisable ;
- build OK.

Non validé côté environnement :

- migration distante ;
- RLS réel ;
- CRUD réel distant ;
- email transactionnel réel.

