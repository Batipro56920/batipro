# Phase A — Lot 2 — Fermeture RLS (brouillon, non appliqué)

Brouillon uniquement. Rien n'a été appliqué à Supabase, rien n'a été poussé sur `origin`. SQL complet dans :
- `supabase/migrations_draft/20260824_lot2_rls_closure_DRAFT.sql` (aller)
- `supabase/migrations_draft/20260824_lot2_rls_closure_ROLLBACK_DRAFT.sql` (retour)

Ces deux fichiers vivent hors de `supabase/migrations/` pour ne jamais être ramassés comme migrations réelles.

Périmètre confirmé exclu, comme convenu : `apporteur_access`, `document_client_workflows` — aucune ligne du brouillon ne les touche.

---

## 1. Inventaire complet — état actuel vs état cible

Toutes les policies ci-dessous ont été lues en direct sur le projet Supabase actif (`vhwtpwmzaidmlvqcyfep`) via `pg_policies`, pas déduites des migrations.

### 1.1 Déjà fermées — aucun changement proposé

| Table | Policy actuelle | Verdict |
|---|---|---|
| `chantier_time_entries` | 1 seule : `chantier_time_entries_admin_all` (`for all`, `role = 'ADMIN'` via `profiles`) | Déjà fermée à `anon`/non-admin. Rien à faire. |
| `terrain_feedbacks` | 1 seule : `terrain_feedbacks_admin_all` (`for all`, `_terrain_feedback_is_admin()`) | Déjà fermée. Les écritures du portail terrain passent par la RPC `security definer` `intervenant_terrain_feedback_create`, qui contourne cette policy comme prévu — aucun impact. |

### 1.2 Groupe A — chantiers et tables liées

| Table | État actuel | État cible |
|---|---|---|
| `chantiers` | 7 policies empilées : 3 anciennes `to public`/`authenticated` `using(true)` (`insert chantiers`, `read chantiers`, `chantiers_auth_*`) + `chantiers_select_intervenant` (correcte). Pas de colonne `organization_id`. | Colonne `organization_id` ajoutée (backfill + default + not null). Policies : `chantiers_admin_all` (`is_admin()` + org), `chantiers_select_intervenant` conservée à l'identique. |
| `chantier_tasks` | 4 policies `to anon, authenticated` `using(true)` (lecture/écriture totalement ouvertes, y compris sans session) + `tasks_select_intervenant` (correcte). | `chantier_tasks_admin_all` (`is_admin()` + org via jointure `chantiers`), `tasks_select_intervenant` conservée à l'identique. |
| `chantier_reserves` | 3 policies `to public` `using(true)` **en plus** de policies admin/intervenant déjà correctement scopées (role `ADMIN`, email JWT). Les policies permissives dominent. | Retrait des 3 policies `to public` uniquement. Le reste (déjà correct) n'est pas touché. |
| `materiel_demandes` | 13 policies empilées, aucune réellement restrictive (les "scopées" vérifient juste que le `chantier_id` existe, ce qui est toujours vrai). | `materiel_demandes_admin_all` (`is_admin()` + org via jointure `chantiers`). ⚠️ voir avertissement §3. |

### 1.3 Groupe B — cluster CRM / devis / factures / apporteurs / paramètres (41 tables)

Toutes suivent l'un de ces deux états actuels, vérifiés en direct :

- **39 tables** : `organization_id = auth.uid()` (données ET policies), soit 4 policies séparées (select/insert/update/delete) soit 1 policy `for all` — `company_settings`, `suppliers`, `crm_sources`, `crm_tags`, `crm_pipeline_stages`, `crm_clients`, `crm_prospects`, `crm_opportunities`, `crm_quotes`, `crm_quote_items`, `crm_tasks`, `crm_appointments`, `crm_documents`, `crm_notes`, `crm_communications`, `crm_invoices`, `crm_sav`, `crm_quote_lots`, `crm_quote_resources`, `crm_quote_sections`, `crm_quote_components`, `crm_quote_revisions`, `crm_quote_signatures`, `crm_payment_terms`, `crm_purchases`, `quote_library_items`, `quote_library_templates`, `quote_imports`, `quote_favorites`, `company_quote_settings`, `invoices`, `purchase_orders`, `product_catalog_items`, `reception_reports`, `crm_visit_reports`, `crm_visit_report_items`, `crm_visit_report_attachments`, `apporteurs_affaires`, `profile_permission_presets`.
- **2 tables** : `apporteur_leads`, `apporteur_documents` — RLS activée, **zéro policy** définie → deny-all total aujourd'hui (y compris pour l'admin). Pas une fermeture à faire, une vraie correction : ces tables sont actuellement inutilisables via le client authentifié normal.

**Cible unique pour les 41** : donnée migrée vers le vrai `organization_id`, `DEFAULT` de la colonne pointé sur l'organisation réelle (au lieu de `auth.uid()`), 4 policies standard `to authenticated` utilisant `organization_id = (select current_organization_id())`.

### 1.4 Exclues (confirmé, non touchées)

| Table | Pourquoi exclue |
|---|---|
| `apporteur_access` | Accès token portail apporteur — admin-only via `is_admin()`, pas basé sur `organization_id`. Ne pas toucher. |
| `document_client_workflows` | Accès token documents client — mêmes policies `organization_id = auth.uid()` que le cluster B, mais protégé explicitement par consigne produit. |

---

## 2. Fonction stable de résolution de l'organisation

```sql
create or replace function public.current_organization_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select organization_id from public.profiles where id = auth.uid()
$$;

grant execute on function public.current_organization_id() to authenticated;
```

**Pourquoi `security definer`** : garantit que la fonction peut toujours lire la ligne `profiles` de l'appelant, indépendamment d'une éventuelle évolution future de la RLS sur `profiles` (aujourd'hui `profiles_read_own` l'autorise déjà en self-read, mais on ne veut pas coupler ce helper à cette policy précise).

**Pourquoi `stable` (pas `volatile`)** : un appel `stable` enveloppé en `(select public.current_organization_id())` dans une policy est traité par Postgres comme un InitPlan à évaluation unique par requête, plutôt que ré-exécuté ligne par ligne — c'est le pattern recommandé par Supabase pour les fonctions d'auth utilisées en RLS. Chaque policy du brouillon utilise systématiquement cette forme enveloppée.

**Impact perf attendu** : la fonction fait une lecture indexée sur la clé primaire de `profiles` (3 lignes aujourd'hui) — coût sub-milliseconde, évalué une fois par requête grâce au wrapping ci-dessus, pas une fois par ligne parcourue. Le `security definer` ajoute un coût fixe de changement de rôle, identique à celui déjà payé par `is_admin()` partout ailleurs dans le schéma — non mesurable à cette échelle, et resterait négligeable même à plusieurs dizaines d'utilisateurs. Retourne `NULL` si l'appelant n'a pas de profil (ex. le compte `auth.users` orphelin détecté en Lot 1, `b.j-y@wanadoo.fr`) — `organization_id = NULL` échoue systématiquement en RLS (`NULL` ne matche jamais), donc refus par défaut, jamais d'ouverture accidentelle.

---

## 3. Point d'attention avant application — `materiel_demandes`

Contrairement aux autres tables du Groupe A, je n'ai pas pu confirmer si le portail terrain (`EmployeePortalV2Page`, action "demande matériel") écrit dans `materiel_demandes` via une session authentifiée directe (auquel cas il faudrait une policy intervenant supplémentaire, sur le modèle de `chantier_reserves_intervenant_update`) ou exclusivement via une RPC `security definer` qui contournerait cette RLS de toute façon (comme pour `terrain_feedbacks`). Le brouillon ne pose qu'une policy admin-only pour l'instant — à vérifier avant application, sans quoi la création de demande matériel depuis le portail terrain (session réelle, pas le token déprécié) pourrait casser silencieusement.

---

## 4. `service_role`

Vérifié en direct (`pg_roles.rolbypassrls`) : `service_role` a `bypassrls = true` au niveau Postgres — il **contourne intégralement RLS**, quelles que soient les policies en place. Aucune policy explicite n'est donc nécessaire pour le préserver ; les Edge Functions qui écrivent avec la clé `service_role` (`redeem-intervenant-invitation`, `chantier-access-admin`, `generate-intervenant-link`, etc.) continueront de fonctionner à l'identique, sans changement, avant comme après ce brouillon.

---

## 5. Nettoyage advisory GraphQL/anon sur `organizations`

L'advisory signalé après le Lot 1 (`organizations` visible dans le schéma GraphQL pour `anon`) vient du `GRANT` de table par défaut, indépendant de la RLS (la policy `organizations_authenticated_select` bloquait déjà les lectures `anon` au niveau des lignes). Le brouillon ajoute :

```sql
revoke all on public.organizations from anon;
```

---

## 6. Adaptation front (point 3, Lot 1 fondu dans le Lot 2)

Un seul point d'entrée à ajouter, dans `src/services/currentUserProfile.service.ts` (déjà le module canonique "qui suis-je") :

```ts
export async function getCurrentOrganizationId(): Promise<string> {
  const profile = await getCurrentUserProfile();
  if (!profile?.organization_id) throw new Error("Organisation introuvable pour cet utilisateur.");
  return profile.organization_id;
}
```

Puis, 7 endroits qui calculent aujourd'hui `organization_id` eux-mêmes en renvoyant `auth.getUser().id` (l'id du créateur) doivent appeler cette fonction à la place :

| Fichier | Fonction locale à corriger |
|---|---|
| `src/services/apporteurs.service.ts:97` | `getOrganizationId()` — appelle `getCurrentUserId()` aujourd'hui |
| `src/services/crm.service.ts:520` | `currentOrgId()` — appelle `supabase.auth.getUser()` |
| `src/services/crmVisitReports.service.ts:137` | `currentOrgId()` — idem |
| `src/features/quotes/infrastructure/quoteLibraryRepository.ts:217` | `currentOrgId()` — idem |
| `src/features/quotes/infrastructure/companyQuoteSettingsRepository.ts:139` | `currentOrgId()` — idem |
| `src/services/companySettings.service.ts:154` | `getCurrentUserId()` — utilisé comme `organization_id` en ligne 277/311 |
| `src/services/companyTravelSettings.service.ts:70` | `userId` en ligne — pas de fonction nommée, calcul inline |

Ces 7 changements ne doivent être appliqués qu'**après** la migration Supabase (sinon les nouvelles valeurs envoyées par le front seraient rejetées par les anciennes policies `organization_id = auth.uid()` encore en place). Aucun autre appelant de `organization_id` n'a été trouvé dans `src/` en dehors de ces 7 + `ApporteurPortalPage.tsx` (qui relaie simplement `apporteur.organization_id` reçu du serveur, pas de calcul local — rien à changer là).

---

## 7. Test de preuve — requête anonyme refusée

À exécuter après application, avec le rôle `anon` (clé publique, sans session) :

```sql
set role anon;
select count(*) from public.chantiers;
select count(*) from public.chantier_tasks;
select count(*) from public.chantier_reserves;
select count(*) from public.invoices;
reset role;
```

Résultat attendu : `0` sur les quatre (pas d'erreur "permission denied" — les `GRANT` de table restent en place, mais RLS ne laisse passer aucune ligne puisque toutes les nouvelles policies sont `to authenticated` uniquement). C'est la preuve recherchée : refusé en pratique, sans distinguer "erreur" de "vide", les deux formulations du critère sont couvertes.

---

## 8. Ordre d'application proposé, avec point de vérification après chaque groupe

1. **Groupe 0** (fonction `current_organization_id()` + nettoyage grant `organizations`) — aucune donnée ni policy métier touchée, risque nul. Vérification : `select public.current_organization_id()` renvoie l'id de l'organisation en étant connecté en admin.
2. **Groupe A.3 `chantier_reserves`** seul en premier (le plus sûr — retrait de 3 policies sans rien recréer). Vérification app : page réserves chantier, lecture + création + passage "levée" en tant qu'admin.
3. **Groupe A.1+A.2 `chantiers` + `chantier_tasks`** (colonne + policies liées, doivent passer ensemble car `chantier_tasks_admin_all` référence `chantiers.organization_id`). Vérification app : liste chantiers, ouverture d'un chantier, liste des tâches, création/édition d'une tâche.
4. **Groupe A.4 `materiel_demandes`** — seulement après la vérification du point d'attention §3. Vérification app : demandes matériel (liste + création) en tant qu'admin.
5. **Groupe B**, par sous-lots pour limiter le rayon d'un incident, dans cet ordre :
   a. `company_settings`, `suppliers` — vérification : page Mon entreprise, page Fournisseurs.
   b. `crm_*` (clients, prospects, opportunités, devis, tâches, rendez-vous, documents, notes, communications, sav, sources, tags, pipeline) — vérification : CRM (dashboard, fiche client, fiche devis).
   c. `invoices`, `purchase_orders`, `crm_invoices`, `reception_reports` — vérification : Factures, Bons de commande, Rentabilité (déjà durcie au lot précédent).
   d. `product_catalog_items`, `quote_library_items`, `quote_library_templates`, `quote_imports`, `quote_favorites`, `company_quote_settings` — vérification : Catalogue produits, Bibliothèque devis.
   e. `apporteurs_affaires`, `apporteur_leads`, `apporteur_documents` — vérification : page Apporteurs d'affaires (sait qu'aujourd'hui `apporteur_leads`/`apporteur_documents` renvoient probablement déjà vide/erreur avant même ce brouillon — comparer avant/après).
   f. `crm_visit_reports`, `crm_visit_report_items`, `crm_visit_report_attachments`, `profile_permission_presets` — vérification : comptes rendus de visite, page Profils types.
6. **Adaptation front** (§6, les 7 fichiers) — seulement une fois TOUT le Groupe B validé en base, jamais avant (sinon écritures rejetées entre-temps). Vérification : `tsc`, `build`, puis un cycle complet créer/lire/modifier sur un devis CRM et une fiche apporteur.
7. **Test de preuve anonyme** (§7) — dernière étape, sur l'ensemble déjà validé.

Chaque étape est un rollback indépendant possible : le fichier ROLLBACK est découpé dans le même ordre de groupes, exécutable partiellement si l'incident est localisé à un groupe précis plutôt qu'à la totalité.

---

## 9. Ce que je n'ai PAS mis dans ce brouillon (hors périmètre demandé)

- Consolidation des 3 fonctions admin identiques (`is_admin()`, `batipro_is_admin()`, `_terrain_feedback_is_admin()`) — l'audit initial n'en trouvait que 2, il y en a en réalité 3. Je réutilise `is_admin()` telle quelle dans le brouillon sans y toucher. À traiter dans un lot dédié si voulu.
- Durcissement de `search_path` sur `is_admin()`/`_terrain_feedback_is_admin()` (il leur manque `pg_temp`, seule `batipro_is_admin()` l'a) — la nouvelle fonction `current_organization_id()` l'a correctement dès sa création, mais je n'ai pas retouché les fonctions existantes.
- `chantier_time_entries` et `terrain_feedbacks` : déjà fermées, volontairement non touchées (voir §1.1).
