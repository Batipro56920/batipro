# Sprint E - Infra / stabilité

Date : 2026-05-19

## 1. Supabase distant

Statut : bloqué infrastructure.

Commandes lancées :

- `supabase status` : environnement local actif.
- `supabase projects list` : projet distant lié `vhwtpwmzaidmlvqcyfep`.
- `supabase migration list` : échec sur connexion distante.

Erreur distante :

```text
failed SASL auth (FATAL: password authentication failed for user "postgres")
Connect to your database by setting the env var correctly: SUPABASE_DB_PASSWORD
```

Constat :

- La variable `SUPABASE_DB_PASSWORD` existe dans l'environnement shell.
- Sa valeur actuelle est rejetée par Supabase.
- La validation distante des migrations, RLS, CRUD et droits utilisateur ne peut pas être considérée comme validée.

Action requise :

- Remettre le mot de passe DB Postgres correct dans `SUPABASE_DB_PASSWORD`.
- Relancer `supabase migration list`.
- Relancer `supabase db push` ou `supabase db pull` selon la stratégie retenue.

## 2. Supabase local

Commandes lancées :

- `supabase migration list --local`
- `supabase db query --local "select count(*) as count from public.invoices"`

Constat :

- Les fichiers de migration existent, dont `20260519090000_business_documents_supabase_v1.sql`.
- La table locale `public.invoices` n'existe pas dans la base locale active.
- La migration `20260519090000` n'est pas enregistrée dans `supabase_migrations.schema_migrations` localement.

Conclusion :

- Les tables critiques Sprint B ne sont pas validées localement dans la base active.
- Un `supabase db reset --local` appliquerait les migrations, mais c'est destructif pour les données locales. À lancer uniquement après accord.

## 3. RLS

Migration auditée :

- `supabase/migrations/20260519090000_business_documents_supabase_v1.sql`

Tables prévues :

- `invoices`
- `purchase_orders`
- `product_catalog_items`
- `reception_reports`

RLS prévu dans la migration :

- RLS activée sur les 4 tables.
- Policies select/insert/update/delete pour rôle `authenticated`.
- Filtrage par `organization_id = auth.uid()`.

Point critique remonté par Supabase local :

```text
RLS disabled on public.chantier_access, public.chantiers, public.devis,
public.devis_lignes, public.devis_lines, public.intervenants, public.materiel_demandes.
```

Ne pas corriger automatiquement sans cadrage, car activer RLS sans policies adaptées peut bloquer des modules existants.

## 4. Performance bundle

Actions appliquées :

- Lazy-loading ajouté pour pages lourdes encore synchrones :
  - Dashboard
  - CRM
  - Chantier détail
  - Nouveau chantier
  - Visites chantier
  - Portail intervenant
  - Intervenants
  - Bibliothèque
  - Statistiques
  - Mon entreprise
  - Retours terrain
- Chunks Vite dédiés ajoutés :
  - `react-vendor`
  - `supabase`
  - `ui-radix`
  - `workspace`
  - `rich-text`
  - `charts`
  - `react-pdf`
  - `pdf-viewer`
  - `jspdf`
  - `html2canvas`

Résultat build :

- Avant : chunk principal applicatif supérieur à 2 MB.
- Après : chunk principal applicatif autour de 149 KB.
- `ChantierPage` est isolée autour de 457 KB.
- `pdf-viewer` est isolé autour de 495 KB.
- `jspdf` est isolé autour de 353 KB.
- `html2canvas` est isolé autour de 201 KB.
- Plus de warning Vite `> 500 kB` sur le dernier build.

## 5. Workbox / PWA

Constat :

- Le seuil `maximumFileSizeToCacheInBytes` reste à `3 * 1024 * 1024`.
- Aucun fichier individuel généré ne dépasse ce seuil après découpage.
- Le total précaché reste élevé, mais cohérent avec une application métier offline/PWA partielle.

Décision :

- Ne pas baisser le seuil dans ce sprint.
- Le vrai sujet restant est la stratégie de précache, à traiter séparément si besoin.

## 6. QA transverse

Smoke test lancé :

- `npm run test:e2e`

Résultat :

- `/` OK
- `/login` OK
- `/dashboard` OK
- `/intervenant` OK
- `/acces/demo-token` OK

Non validé automatiquement :

- Parcours complet prospect → projet → devis → facture → paiement → bon de commande → rentabilité → PV réception.
- Raison : nécessite données métier et Supabase distant fonctionnel.

## 7. Build

Commande :

- `npm run build`

Résultat :

- OK.
- Aucun warning gros chunk Vite sur le dernier build.

## Conclusion

Validé :

- Build.
- Code-splitting.
- Isolation PDF/document-engine.
- Smoke E2E minimal.
- Audit migration Sprint B.

Bloqué :

- Connexion Supabase distante.
- QA CRUD/RLS réelle distante.
- Tables Sprint B absentes de la base locale active sans reset.

