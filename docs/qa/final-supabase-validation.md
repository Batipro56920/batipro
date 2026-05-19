# Final Supabase validation - post Stream E

Date: 2026-05-19

## Decision

Status: blocked, not validated for Stream F.

Batipro cannot be marked as a real persistent and secured remote-backend application yet. The local code and migration filenames are clean enough to continue validation, but the remote Supabase database cannot be reached by the CLI because the current `SUPABASE_DB_PASSWORD` is rejected by Postgres.

Stream F must stay blocked until the remote checks below are executed successfully.

## 1. Migration state

Local migration filename repair completed:

| Old timestamp | New timestamp | File |
| --- | --- | --- |
| `20260402240000` | `20260402235900` | `company_feature_settings_v1.sql` |
| `20260402250000` | `20260403000100` | `chantier_tasks_refonte_v1.sql` |
| `20260402260000` | `20260403000200` | `chantier_task_zones_v1.sql` |

Local checks:

- All migration timestamps parse as valid `yyyyMMddHHmmss`.
- Chronological order around 2026-04-02 / 2026-04-03 is coherent.
- SQL content was not edited during the rename.
- Local missing migration is present: `20260519123000_library_products_intervenants_v1.sql`.

Remote check attempted:

```bash
supabase migration list
```

Result:

```text
failed SASL auth (FATAL: password authentication failed for user "postgres")
Connect to your database by setting the env var correctly: SUPABASE_DB_PASSWORD
```

Conclusion:

- `supabase migration list` is not clean yet because the remote auth check cannot complete.
- Local/remote divergence cannot be confirmed or denied until the DB password is corrected.
- `20260519123000` was not applied remotely during this validation pass.

Required next commands after fixing `SUPABASE_DB_PASSWORD`:

```bash
supabase migration list
supabase db push
supabase migration list
```

Acceptance criteria:

- No invalid timestamp error.
- No remote-only migration missing locally.
- No local-only migration except the one intentionally pending before `supabase db push`.
- After push, `20260519123000` appears applied remotely.

## 2. Real CRUD QA

Status: blocked remotely.

The requested CRUD must be tested against the real remote Supabase project, not local fallback state and not only browser memory. This was not executed because the remote DB migration state could not be validated.

Required QA matrix:

| Module | Create | Update | Delete | Reload persistence | Multi-navigation | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Factures | pending | pending | pending | pending | pending | blocked |
| Bons de commande | pending | pending | pending | pending | pending | blocked |
| Catalogue produits | pending | pending | pending | pending | pending | blocked |
| PV reception | pending | pending | pending | pending | pending | blocked |

Required method:

1. Open the app with the production Supabase `.env.local`.
2. Sign in as an authenticated user.
3. For each module, create a unique QA record with a timestamp in the title/reference.
4. Navigate away to at least two other modules.
5. Return to the module and verify the record is still present.
6. Reload the page and verify the record is still present.
7. Update a field, navigate away, reload, and verify the update.
8. Delete the record, navigate away, reload, and verify the record stays deleted.

## 3. RLS QA

Status: blocked remotely.

Existing local migration for legacy RLS:

- `20260519110000_legacy_core_tables_rls_v1.sql`

Tables targeted by progressive RLS:

- `devis`
- `devis_lignes`
- `chantiers`
- `intervenants`
- `materiel_demandes`
- `chantier_access`

Required progression:

| Step | Table | Action | Linked module regression test | Status |
| --- | --- | --- | --- | --- |
| 1 | `chantiers` | Enable RLS and policies | Chantiers list/detail, project links | pending |
| 2 | `devis` | Enable RLS and policies | CRM devis, quote builder, project quote links | pending |
| 3 | `devis_lignes` | Enable RLS and policies | Devis line create/update/delete, totals | pending |
| 4 | `intervenants` | Enable RLS and policies | Intervenants list/detail, chantier assignment | pending |
| 5 | `materiel_demandes` | Enable RLS and policies | Material requests from chantier/intervenant flows | pending |
| 6 | `chantier_access` | Enable RLS and policies | Access links, public portal function flow | pending |

Security acceptance criteria:

- Authenticated user can perform expected reads and writes.
- Anonymous client cannot read or mutate protected tables directly.
- Public portal access still goes through Edge Functions or token RPC flows.
- No table is left with RLS disabled unless explicitly documented with owner/admin blocker.

## 4. Transverse workflow QA

Status: blocked remotely.

Required full workflow:

```text
prospect
-> projet
-> devis
-> facture
-> bon commande
-> rentabilite
-> chantier
-> PV reception
```

Acceptance criteria:

- Each step creates or updates remote Supabase data.
- Navigation between CRM, project, documents, chantier, and reception modules preserves state.
- Project profitability includes invoices and purchase orders after reload.
- Chantiers and PV reception stay linked after reload.
- No RLS error appears in the browser console or UI.

## 5. Local checks completed

These checks do not replace remote validation, but confirm the app still builds and the shell routes load:

```bash
npm run build
npm run test:e2e
```

Results:

- `npm run build`: OK.
- `npm run test:e2e`: OK.
- Smoke routes checked: `/`, `/login`, `/dashboard`, `/intervenant`, `/acces/demo-token`.

## 6. Blocker

Current blocker:

- `SUPABASE_DB_PASSWORD` is present in the shell, but the value is rejected by the remote Postgres pooler.

Required fix:

1. Reset or retrieve the current Postgres database password from Supabase.
2. Set `SUPABASE_DB_PASSWORD` in the shell running the CLI.
3. Re-run the migration checks.
4. Apply pending migrations.
5. Execute the CRUD, RLS, and transverse workflow QA above.

## Final conclusion

Batipro is not yet validated as a real persistent and secured remote-backend application after Stream E.

Stream F should start only after:

- `supabase migration list` is clean.
- `20260519123000` is applied remotely.
- The four CRUD modules pass persistence/reload/multi-navigation checks.
- Progressive RLS activation passes without module regression.
- The transverse workflow passes end to end on the remote Supabase backend.
