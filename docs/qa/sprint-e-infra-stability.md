# Sprint E - Infra / stabilité

Date : 2026-05-19

## Synthèse

Statut global : partiel.

Validé :

- Build applicatif OK.
- Découpage bundle toujours sain, sans warning Vite `> 500 kB`.
- Migration RLS legacy créée et testée localement sur les tables modifiables.
- RLS locale activée sur `chantiers`, `devis`, `devis_lignes`, `devis_lines`.
- Policies locales créées pour `authenticated` sur les 4 tables ci-dessus.

Bloqué :

- Connexion Supabase distante.
- Validation migrations distantes.
- CRUD distant réel.
- RLS distante réelle.
- Stream F non lancé, car il dépend d'une base distante fiable pour audit trail, tokens et workflow client.

## 1. Connexion Supabase distante

Commande :

```bash
supabase migration list
```

Résultat :

```text
failed SASL auth (FATAL: password authentication failed for user "postgres")
Connect to your database by setting the env var correctly: SUPABASE_DB_PASSWORD
```

Constat :

- `SUPABASE_DB_PASSWORD` existe dans l'environnement shell.
- La valeur actuelle est rejetée par Postgres Supabase.
- Aucune validation distante ne doit être considérée comme faite.

Action requise :

- Remettre le mot de passe DB Postgres correct dans `SUPABASE_DB_PASSWORD`.
- Relancer `supabase migration list`.
- Relancer ensuite `supabase db push` ou la stratégie de migration retenue.

## 2. Migrations

Nouvelle migration créée :

- `supabase/migrations/20260519110000_legacy_core_tables_rls_v1.sql`

Migration Sprint B existante :

- `supabase/migrations/20260519090000_business_documents_supabase_v1.sql`

Tables Sprint B prévues :

- `invoices`
- `purchase_orders`
- `product_catalog_items`
- `reception_reports`

Statut local :

- Ces tables ne sont pas présentes dans la base locale active, car les migrations récentes ne sont pas rejouées localement.
- Un `supabase db reset --local` appliquerait les migrations, mais c'est destructif pour les données locales et n'a pas été lancé.

## 3. RLS legacy

Audit initial local :

- RLS désactivée sur 7 tables legacy :
  - `chantier_access`
  - `chantiers`
  - `devis`
  - `devis_lignes`
  - `devis_lines`
  - `intervenants`
  - `materiel_demandes`

Après migration locale :

| Table | RLS local | Policies | Statut |
| --- | --- | --- | --- |
| `chantiers` | activée | select/insert/update/delete `authenticated` | OK local |
| `devis` | activée | select/insert/update/delete `authenticated` | OK local |
| `devis_lignes` | activée | select/insert/update/delete `authenticated` | OK local |
| `devis_lines` | activée | select/insert/update/delete `authenticated` | OK local |
| `intervenants` | désactivée | non créée | bloquée owner `supabase_admin` |
| `materiel_demandes` | désactivée | non créée | bloquée owner `supabase_admin` |
| `chantier_access` | désactivée | non créée | bloquée owner `supabase_admin` |

Point critique :

- Les 3 tables `supabase_admin` restent exposées localement selon l'advisory Supabase.
- Il faut une intervention owner/admin ou une migration exécutée avec le rôle propriétaire pour les sécuriser.
- Le portail public intervenant utilise `supabase.functions.invoke("chantier-access")`, donc il ne nécessite pas d'ouvrir `chantier_access` en lecture anonyme directe.

## 4. CRUD distant

Modules demandés :

- Factures
- Bons de commande
- Catalogue produits
- PV réception

Statut :

- Non validé à distance.
- Cause : connexion DB distante refusée.
- Localement, les tables Sprint B ne sont pas présentes dans la base active sans reset local.

Validation à relancer après correction du mot de passe DB :

- Créer / modifier / supprimer / recharger pour `invoices`.
- Créer / modifier / supprimer / recharger pour `purchase_orders`.
- Créer / modifier / supprimer / recharger pour `product_catalog_items`.
- Créer / modifier / supprimer / recharger pour `reception_reports`.
- Vérifier les liaisons projet / chantier / client / fournisseur.
- Vérifier les remontées rentabilité.

## 5. Performance bundle

Commande :

```bash
npm run build
```

Résultat :

- OK.
- Aucun warning gros chunk Vite.
- Chunks principaux observés :
  - `index` autour de 149 KB
  - `ChantierPage` autour de 457 KB
  - `pdf-viewer` autour de 495 KB
  - `jspdf` autour de 353 KB

Décision :

- Pas d'action supplémentaire immédiate sur le seuil Workbox.
- Les libs PDF et pages lourdes sont déjà isolées.

## 6. Stream F

Statut : non lancé volontairement.

Raison :

- Le workflow client réel doit écrire des événements horodatés, tokens, statuts d'acceptation/refus et audit trail dans Supabase.
- Tant que la connexion distante et le RLS réel ne sont pas validés, démarrer Resend / portail client / signature V1 créerait une couche métier non vérifiée.

Pré-requis avant lancement :

- `supabase migration list` distant OK.
- Migrations Sprint B + RLS appliquées.
- CRUD distant validé sur documents critiques.
- RLS validée pour lecture/écriture utilisateur connecté.

## Conclusion

Sprint E est techniquement avancé côté code et local, mais non validable en production tant que `SUPABASE_DB_PASSWORD` reste incorrect.

Prochaine action prioritaire :

1. Corriger le secret `SUPABASE_DB_PASSWORD`.
2. Relancer `supabase migration list`.
3. Appliquer les migrations.
4. Refaire QA CRUD/RLS distante.
5. Lancer Stream F seulement après validation.
