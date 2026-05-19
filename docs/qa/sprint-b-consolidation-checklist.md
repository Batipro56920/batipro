# QA Sprint B - Consolidation Supabase

Date : 2026-05-19

## 1. Tables Supabase

Tables attendues dans la migration `20260519090000_business_documents_supabase_v1.sql` :

- `invoices`
- `purchase_orders`
- `product_catalog_items`
- `reception_reports`

Contrôles locaux effectués :

- Tables présentes dans la migration.
- Index métier présents.
- RLS activé sur les 4 tables.
- Policies `select`, `insert`, `update`, `delete` limitées à `authenticated`.
- Isolation par `organization_id = auth.uid()`.
- Grants limités à `authenticated`.

Contrôle distant non finalisé :

- `supabase migration list` échoue car `SUPABASE_DB_PASSWORD` n'est pas configuré dans l'environnement local.
- À valider après configuration du mot de passe DB ou depuis le dashboard Supabase.

## 2. CRUD complet

À tester dans l'application après application de la migration :

- Factures : créer, modifier, enregistrer, recharger, retrouver.
- Bons de commande : créer, modifier, enregistrer, recharger, retrouver.
- Catalogue produits : créer, modifier, supprimer, recharger.
- PV réception : créer depuis chantier, modifier, enregistrer, recharger.

Résultat attendu :

- Les données persistent après reload.
- Les écrans affichent un état de chargement et un message d'erreur métier si Supabase est indisponible.
- Aucune écriture V1 locale ne doit être utilisée comme source de vérité.

## 3. Liaisons métier

À vérifier :

- Facture liée à `project_id`, `chantier_id` et snapshot client dans `document`.
- Bon de commande lié à `supplier_id`, `project_id`, `chantier_id`.
- Produit catalogue inséré dans un bon de commande avec fournisseur, prix HT, TVA et unité.
- PV lié à `chantier_id`.
- Rentabilité projet recalculée à partir des factures et bons de commande Supabase.

## 4. Migration legacy

Comportement attendu :

- Les clés legacy `localStorage` sont lues une seule fois.
- Les données sont importées en Supabase.
- Les anciennes clés sont supprimées après import réussi.
- Aucun doublon ne doit apparaître au reload.

Clés legacy concernées :

- `batipro.invoices.v1`
- `batipro.purchase-orders.v1`
- `batipro.product-catalog.v1`
- `batipro.reception-reports.v1`

Note :

- Les références `localStorage` restantes dans ces modules servent uniquement à l'import legacy et à la suppression de clé.

## 5. RLS

À tester avec Supabase appliqué :

- Utilisateur connecté : lecture/écriture autorisée sur ses lignes.
- Utilisateur anonyme : aucun accès direct.
- Utilisateur A : ne voit pas les lignes de l'utilisateur B.

Requêtes de contrôle recommandées :

- `select * from invoices`
- `insert into invoices (...) values (...)`
- `update invoices set status = 'sent' where id = ...`
- `delete from invoices where id = ...`

Répéter sur les 4 tables.

## 6. Build

Validation locale :

- `npm run build` : OK.
- Warning Vite gros chunks : connu, non bloquant pour cette QA.

