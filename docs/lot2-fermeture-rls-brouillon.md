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

## 1bis. Incident Groupe 2 — récursion RLS, détecté et corrigé immédiatement

Après application du Groupe 2, le test de vérification (`UPDATE ... RETURNING` en admin sur `chantiers`/`chantier_tasks`) a échoué avec `ERROR 42P17: infinite recursion detected in policy for relation "chantiers"`.

**Cause** : `chantiers_select_intervenant` interroge `chantier_tasks` ; la première version de `chantier_tasks_admin_all` interrogeait `chantiers` en retour (`exists (select 1 from chantiers c where ...)`) — cycle `chantiers → chantier_tasks → chantiers`. Chaque sous-requête dans une policy est elle-même soumise à la RLS de la table qu'elle interroge, sauf si elle passe par une fonction `SECURITY DEFINER` — ce n'était pas le cas ici.

**Correction appliquée immédiatement** (avant de continuer, conformément à la consigne) : nouvelle fonction `chantier_organization_id(uuid)`, `SECURITY DEFINER`, qui lit `chantiers` sans redéclencher sa RLS — `chantier_tasks_admin_all` a été recréée pour l'utiliser à la place de la sous-requête en ligne. Re-testé : `chantiers` et `chantier_tasks` accessibles en lecture/écriture par l'admin, comptes identiques à avant migration (3 chantiers, 12 tâches).

`materiel_demandes_admin_all` (Groupe 3, pas encore appliqué) avait la même forme — corrigée dans le brouillon avant application pour ne pas reproduire l'incident.

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

**Deuxième fonction, ajoutée suite à l'incident §1bis** : `chantier_organization_id(p_chantier_id uuid)`, même forme (`stable security definer set search_path = public, pg_temp`), utilisée par toute policy d'une table qui référence `chantiers` via `chantier_id` (`chantier_tasks_admin_all`, `materiel_demandes_admin_all`) — jamais un `exists (select ... from chantiers ...)` en ligne, pour éviter toute récursion RLS vers `chantiers`.

---

## 3. `materiel_demandes` — vérifié dans le code, sans impact

Vérification demandée faite directement dans le code (pas en base) :

- **Écriture portail terrain** : `src/services/intervenantPortal.service.ts:672-680` (`intervenantMaterielCreate`) appelle la RPC `intervenant_materiel_create(p_token, p_payload)`. Sa définition la plus récente (`supabase/migrations/20260323120000_task_terrain_titles_v1.sql:182-188`) est `language plpgsql security definer set search_path = public, pg_temp`, `grant execute ... to anon, authenticated` (ligne 300-301). L'`INSERT INTO public.materiel_demandes` a lieu à l'intérieur de la fonction (ligne 246), après un contrôle d'accès via `_intervenant_assert_chantier_access(p_token, v_chantier_id)` (ligne 208) — le même helper que celui utilisé par `terrain_feedbacks`. Cette RPC couvre **les deux variantes du portail** (token déprécié ET session Auth réelle, `_intervenant_assert_chantier_access` bascule en interne sur les deux selon que `p_token` est renseigné ou non).
- **Lecture portail terrain** : `intervenant_materiel_list` (même fichier de migration, ligne 304-327), même mécanisme.
- **Côté admin** (`src/services/materielDemandes.service.ts`), utilisé uniquement par `ChantierPage.tsx` : `insert`/`update`/`delete` passent par le client Supabase standard (session admin authentifiée), donc bien soumis à la RLS — c'est exactement ce que couvre la nouvelle policy `materiel_demandes_admin_all` (`is_admin()` + organisation).

**Conclusion : la fermeture RLS sur `materiel_demandes` est sans impact sur le portail terrain, RPC `security definer` de bout en bout.** Le brouillon SQL (§ groupe A.4) est appliqué tel quel, sans avertissement ni fonctionnalité désactivée.

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
