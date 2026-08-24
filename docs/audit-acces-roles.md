# Audit — Système d'accès et de rôles

Audit en lecture seule de l'existant, réalisé avant la conception d'un système de rôles personnalisables (comptable, conducteur de travaux, intervenant, employé, etc.) avec portails/vues adaptés. Aucune modification de code, de migration ni de RLS n'a été faite pour produire ce document.

Date : 2026-08-24. Dépôt : `Batipro-latest`, branche `main`.

---

## 1. Authentification & profils

### 1.1 Comment un utilisateur est-il rattaché à un rôle ?

La table `public.profiles` (`supabase/migrations/20260213082201_remote_schema.sql:168-173`) relie `id uuid` (FK 1:1 vers `auth.users.id`, `on delete cascade`, ligne 625) à `role text not null` et `display_name text`.

Le rôle est un **`text` contraint par un `CHECK`, pas un enum Postgres** :
- Contrainte initiale (ligne 629) : `role IN ('ADMIN', 'INTERVENANT')`.
- Élargie par `20260515180000_crm_admin_v1.sql:3-8` (drop + recreate) : `role IN ('ADMIN','COMMERCIAL','CONDUCTEUR','ASSISTANT','INTERVENANT')` — **5 valeurs possibles aujourd'hui**, aucune migration postérieure n'y touche.
- `20260405173000_task_template_preparation_permissions_v1.sql:1-11` ajoute `profiles.feature_permissions jsonb not null default '{}'` : une surcouche de permissions granulaires **par utilisateur**, indépendante du rôle.

### 1.2 Quels rôles existent réellement ?

- Côté base : `ADMIN`, `COMMERCIAL`, `CONDUCTEUR`, `ASSISTANT`, `INTERVENANT` (contrainte CHECK ci-dessus).
- Côté TypeScript : `src/services/currentUserProfile.service.ts:4` type le rôle en `"ADMIN" | "INTERVENANT" | string` — la 3ᵉ branche `string` désactive en pratique toute vérification de type, n'importe quelle chaîne passe.
- **Seuls `ADMIN` et `INTERVENANT` ont un traitement dédié côté front** : `isAdminProfile()` / `isIntervenantProfile()` (`currentUserProfile.service.ts:147-153`). `COMMERCIAL`, `CONDUCTEUR`, `ASSISTANT` existent en base mais **n'ont aucune logique front associée** — dans les faits, le front ne distingue qu'admin / non-admin.
- Un système parallèle et plus riche existe : `BusinessProfilePresetId` (`profileFeaturePermissions.service.ts:58-65`) définit 7 étiquettes : `dirigeant | commercial | conducteur_de_travaux | comptable | administratif | intervenant_terrain | sous_traitant`. C'est un **catalogue de préréglages de permissions**, stocké dans `profile_permission_presets` (scoping par `organization_id`), **découplé de `profiles.role`**. Notamment, `"comptable"` existe ici mais n'est **pas** une valeur valide de `profiles.role` — les presets ajoutent une couche de permissions par-dessus le rôle, ils ne l'étendent pas dans la base.
- `isAdminRole()` (`profileFeaturePermissions.service.ts:379-380`) fait une comparaison de chaîne insensible à la casse : le rôle est traité comme du texte libre partout, jamais comme un type strict.

### 1.3 Trois systèmes d'identité disjoints

| Système | Table | Lien vers `auth.users` | Rôle/accès |
|---|---|---|---|
| Utilisateur back-office | `profiles` | 1:1 obligatoire (`id` = `auth.users.id`) | `profiles.role` (5 valeurs) |
| Intervenant terrain | `intervenants` (`20260213082201_remote_schema.sql:115-123`) | `user_id` **nullable** — un intervenant peut exister sans aucun compte Supabase Auth | via token ou compte lié (§2) |
| Apporteur d'affaires | `apporteurs_affaires` (`20260520143000_apporteurs_affaires_v1.sql:3-18`) | **aucun** lien `auth.users` | uniquement via `apporteur_access.token` |

Il n'existe donc pas une seule notion d'« utilisateur » dans le système, mais trois, avec des garanties d'authentification très différentes.

### 1.4 Résolution runtime de « qui suis-je »

`getCurrentUserProfile()` (`currentUserProfile.service.ts:91-145`) récupère la session Supabase, puis interroge `profiles.select("id, role, display_name, feature_permissions").eq("id", user.id)`, avec repli si la colonne `feature_permissions` n'existe pas encore (ligne 112-118).

**Si aucune ligne `profiles` n'existe**, `buildFallbackProfile()` (ligne 50-67) dérive un rôle depuis `user.app_metadata.role` (claim du JWT Supabase) **ou** une liste blanche d'e-mails côté env (`VITE_ADMIN_EMAILS`, ligne 15-20) — un rôle peut donc être accordé **sans aucune ligne `profiles` ni contrainte base**. Cette liste blanche est une variable `VITE_*`, donc **exposée dans le bundle client**.

`getCurrentProfileFeaturePermissions()` (`profileFeaturePermissions.service.ts:521-542`) superpose ensuite les permissions du preset/override et renvoie `{role, permissions, schemaReady}`.

---

## 2. Mécanismes d'accès existants

### 2.1 État des six tables demandées

| Table | Migration d'origine | Rôle | État |
|---|---|---|---|
| `chantier_access` | `20260131201759_chantier_access.sql:2` | Jeton magic-link par chantier (`token`, `expires_at`, `used_at`, `role`, `intervenant_id` optionnel) | **Actif** — jamais interrogée directement depuis `src/`, mais c'est la table validée par `_intervenant_token_context_v2(p_token)` (`20260515123000_intervenant_account_invites_v1.sql:191-289`), appelée par toutes les RPC du portail intervenant |
| `intervenant_chantiers` | `20260213082201_remote_schema.sql:94` (RLS admin : `20260320121500_intervenant_chantiers_admin_rls.sql`) | Table de jointure intervenant ↔ chantier | **Actif côté serveur** — utilisée dans les policies RLS de `chantier_documents` (`20260213170000_chantier_documents_rls_prod.sql:75`), jamais interrogée directement côté client |
| `intervenant_account_invitations` | `20260515123000_intervenant_account_invites_v1.sql:14` | Invitation par e-mail → création d'un vrai compte `auth.users` pour l'intervenant | **Actif** — 2ᵉ voie d'authentification intervenant, parallèle au token magic-link |
| `document_access` | `20260213150000_chantier_documents_visibility_mode.sql:3` | Octroi d'accès document ↔ intervenant (documents `visibility_mode='RESTRICTED'`) | **Actif**, utilisé par `chantierDocuments.service.ts:394-434` et `taskDocuments.service.ts:95` |
| `document_permissions` | `20260222214000_task_progress_override_and_document_permissions.sql:62` | Quasi-doublon de `document_access` (+ `chantier_id`), back-fillée depuis elle à la création | **Actif mais redondant** — `taskDocuments.service.ts:81` écrit dans les deux tables pour le même document (`:95` écrit aussi `document_access`) |
| `apporteur_access` | `20260520143000_apporteurs_affaires_v1.sql:54` | Même forme de jeton magic-link que `chantier_access`, pour le portail apporteur | **Actif**, utilisé par `apporteurs.service.ts` et l'edge function `apporteur-access` |

**Doublon confirmé** : `document_access` et `document_permissions` couvrent le même besoin (octroi d'accès à un document pour un intervenant donné) sans que l'une ne remplace clairement l'autre — les deux sont écrites en parallèle pour les documents de tâche.

### 2.2 Portail terrain (intervenant) — authentification

Deux mécanismes coexistent, unifiés par `_intervenant_token_context_v2(p_token)` :
1. **Jeton magic-link** (historique mais toujours actif) : l'admin génère une ligne `chantier_access`, envoie le lien ; chaque appel RPC ultérieur passe le jeton brut en `p_token` — pas de JWT, pas de session Supabase, revalidation (`expires_at`/`revoked_at`) à **chaque appel**.
2. **Compte Supabase Auth réel** (plus récent) : via `intervenant_account_invitations`, l'intervenant obtient un vrai compte ; `p_token` est alors `null`, et la fonction se rabat sur `auth.uid()` (`:216-253`).

Les deux voies convergent vers les mêmes RPC (`intervenant_terrain_feedback_create`, etc.), avec un contrôle de portée via `_intervenant_assert_chantier_access(p_token, chantier_id)` (`:295-322`).

### 2.3 Portail apporteur — authentification

Mécanisme distinct : l'edge function `supabase/functions/apporteur-access/index.ts` cherche le token dans `apporteur_access` (`:70-72`) puis **signe et renvoie un JWT** (`signJwt`, `:17`), au lieu d'exiger le jeton brut à chaque appel comme le fait le flux intervenant.

### 2.4 Autre mécanisme trouvé, hors périmètre demandé

`ClientDocumentPage.tsx:11,27` implémente un **troisième schéma de jeton**, distinct des deux précédents : `accessClientDocument(token, action)`, routé par paramètre d'URL, pour la consultation/signature de document côté client final (piste non creusée en profondeur : backing store probable dans le `clientWorkflowRepository` du document-engine).

**Constat clé** : quatre architectures de jeton différentes pour quatre portails (jeton brut revalidé à chaque appel pour `chantier_access`, vrai compte Auth pour `intervenant_account_invitations`, JWT émis par une edge function pour `apporteur_access`, jeton de workflow pour les documents client), sans abstraction commune.

---

## 3. Contrôle d'accès front

### 3.1 Sidebar (`src/components/Sidebar.tsx:74-116`)

Chaque item de navigation porte optionnellement `adminOnly`, `feature` (id de module entreprise) et `permissionKey`. Le prédicat de filtrage (lignes 109-116) exige les trois conditions :
- `adminAllowed = !item.adminOnly || role === "ADMIN"`
- `featureAllowed = !item.feature || enabledModules.has(item.feature)` (modules activés via `getCompanySettings()`)
- `profileAllowed = hasProfileFeaturePermission(permissions, permissionKey ?? feature, role)` (via `getCurrentProfileFeaturePermissions()`)

`adminOnly` n'est utilisé que pour un seul item (`/assistant-direction`) — ce n'est pas un mécanisme de rôle généralisé, seulement un cas particulier.

### 3.2 Garde d'accès globale : `RequireAuth.tsx`

C'est un **verrou ADMIN strict**, pas un simple contrôle « connecté » : `verifyAdminAccess()` appelle `getCurrentUserProfile()` puis `isAdminProfile(profile)` ; si faux, l'utilisateur est **déconnecté de force** (`supabase.auth.signOut()`) et redirigé vers `/login` (ou `/intervenant` si un jeton intervenant est stocké), avec le message « Accès refusé : ce compte n'a pas le rôle ADMIN ».

**Conséquence directe et centrale pour la suite du projet : aujourd'hui, aucun rôle non-admin ne peut accéder à l'application principale.** Seules les pages « portail » séparées (§3.4) servent les utilisateurs non-admin. `COMMERCIAL`, `CONDUCTEUR`, `ASSISTANT` — bien que valides en base (§1.2) — ne peuvent en pratique se connecter à rien du tout côté back-office : soit ils n'ont pas `role = 'ADMIN'` et sont éjectés, soit ils passent par un portail qui ne les concerne pas.

`isAdminProfile` = `role === "ADMIN"` **OU** e-mail présent dans `VITE_ADMIN_EMAILS` (liste blanche exposée dans le bundle client, cf. §1.4).

`RequireCompanyFeature.tsx` gate uniquement sur le module entreprise + `permissionKey` (pas directement sur le rôle, sauf via la branche admin de `hasProfileFeaturePermission`). Il **échoue ouvert** : toute erreur pendant la vérification met `allowed: true` (lignes 61-66) — un souci potentiel de disponibilité vs sécurité (on privilégie ne pas bloquer l'utilisateur en cas d'erreur réseau, au prix d'un accès non vérifié).

### 3.3 Autres gardes par rôle

Aucune autre garde de route par rôle trouvée dans `App.tsx` ou les wrappers (recherche de `role ===`, `ADMIN`, `adminOnly`, `requireRole`). Le contrôle d'accès aux routes est donc **entièrement piloté par les modules entreprise et les clés de permission**, pas par le rôle en tant que tel — à l'exception du verrou global `RequireAuth`.

### 3.4 `ProfileFeaturePermissions` — un système de permissions déjà granulaire

`ProfileFeaturePermissions = Partial<Record<Key, boolean>>`, environ **34 clés distinctes** (modules entreprise + sous-permissions CRM/finance/chantier). C'est un **sac de permissions plat par utilisateur**, pas un enum de rôle : deux utilisateurs non-admin peuvent avoir des jeux de permissions entièrement différents. `hasProfileFeaturePermission` : admin = opt-out par défaut (`!== false`), non-admin = opt-in par défaut (`=== true`).

### 3.5 `/ressources/profils-types` → `ProfileAccessPresetsPage.tsx`

C'est probablement la page visée par « `/entreprise/profils` » dans la demande initiale. Entièrement branchée sur de vrais appels Supabase CRUD : charge/édite/sauvegarde `profile_permission_presets` par identifiant de preset, via une matrice de cases à cocher sur `getProfilePermissionSections()`.

La page se décrit elle-même comme un catalogue de **modèles**, pas des affectations réelles : *« Ces droits seront appliqués ensuite depuis Profils & accès quand tu invites ou configures une personne. »* Dégrade proprement (`schemaReady: false`, valeurs par défaut statiques) si la migration Supabase correspondante n'est pas encore appliquée.

**Point important** : appliquer un preset à un utilisateur (`setProfileFeaturePermissionPresetForUser`, appelé depuis `IntervenantDetailPage.tsx`) **copie** les permissions du preset dans `profiles.feature_permissions` à cet instant précis — il n'y a **aucun lien persistant** utilisateur → preset. Modifier un preset plus tard ne met pas à jour rétroactivement les utilisateurs déjà configurés avec ce preset.

### 3.6 Portails hors Sidebar/RequireAuth, avec vérification inline propre

| Page | Mécanisme |
|---|---|
| `EmployeePortalV2Page.tsx` | `AUTH_SESSION_PORTAL_TOKEN` (sentinelle "utiliser ma vraie session Supabase Auth", `intervenantSession.ts:3`) — variante attendant un vrai compte `auth.users` pour l'intervenant |
| — (ailleurs) | Un autre chemin lit un jeton intervenant stocké (`readStoredIntervenantToken()`), distinct du précédent — **deux flux d'authentification intervenant coexistent côté front**, cohérent avec les deux mécanismes serveur du §2.2 |
| `ApporteurPortalPage.tsx` | `useParams<{token}>()` + `checkApporteurToken(token)` — lien magique par URL, indépendant de Supabase Auth |
| `ClientDocumentPage.tsx` | Même schéma : `useParams` + `accessClientDocument(token, action)`, expiration visible (`token_expires_at`) |

`IntervenantPortalPage.tsx` (variante plus ancienne) n'a pas été creusée en détail — à vérifier si elle est encore utilisée ou si elle est un reliquat.

---

## 4. RLS (Row Level Security)

### 4.1 Constats transverses

- **Deux fonctions d'aide « admin » redondantes**, logiquement identiques (`select exists(... profiles p where p.id = auth.uid() and p.role = 'ADMIN')`) : `public.is_admin()` (`20260213170000_chantier_documents_rls_prod.sql:3`) et `public.batipro_is_admin()` (`20260402220000_batipro_admin_rls_v1.sql:1`). Plusieurs tables réécrivent en plus le même `exists (select 1 from profiles ...)` en ligne, sans passer par l'une ou l'autre. Aucune consolidation.
- **Bug historique réel** : `20260705120000_field_knowledge_engine_v1.sql` a redéfini `batipro_is_admin()` **sans** `security definer`/`set search_path`, cassant silencieusement toutes les policies qui en dépendaient (exécution sous les droits de l'appelant → RLS interne toujours faux). Corrigé par `20260823170000_lot_profiles_usage_and_rls_hardening_v1.sql:40-64`. Ce pattern de fonction d'aide « admin » redéfinie par `create or replace` est fragile — une prochaine migration pourrait recasser silencieusement le même mécanisme.
- **Pas de vraie multi-tenancy.** `organization_id` (présent sur `invoices`, `purchase_orders`, etc.) est défini `uuid not null default auth.uid()` (`20260519090000_business_documents_supabase_v1.sql:3`) — c'est l'id de l'utilisateur créateur, pas un id d'entreprise partagé. Les policies font `organization_id = auth.uid()` (mêmes lignes 104-123). **Deux comptes ADMIN différents ne voient donc pas les factures/commandes/catalogue créés l'un par l'autre** — le concept « organisation » cloisonne par créateur, pas par entreprise. C'est un écart potentiellement important pour un ERP multi-utilisateurs et à considérer sérieusement dans la conception du futur système de rôles.

### 4.2 Table par table

| Table | RLS activé | Policies actuelles | Restriction réelle en base |
|---|---|---|---|
| `chantiers` | Oui | `chantiers_auth_select/insert/update/delete` (`20260519110000_legacy_core_tables_rls_v1.sql:16-37`), toutes `to authenticated using (true)`/`with check (true)`. Une ancienne policy plus fine (`chantiers_select_intervenant`) existe encore mais est neutralisée : Postgres combine les policies permissives en OR, donc la policy `using (true)` suffit à tout ouvrir. | **Aucune** — tout utilisateur connecté (quel que soit son rôle) peut lire/écrire/supprimer n'importe quel chantier |
| `chantier_tasks` | Oui | `read/insert/update/delete chantier_tasks` (`20260213082201_remote_schema.sql:1675-1720`) ciblent **`anon, authenticated`** avec `using (true)`/`with check (true)`. Une policy plus fine (`tasks_select_intervenant`) existe mais est également neutralisée. | **Aucune, et pire : même pas de connexion requise** — une requête avec la seule clé anonyme peut lire/écrire/supprimer n'importe quelle tâche |
| `chantier_reserves` | Oui | SELECT/UPDATE/INSERT (`"Allow read/update/write chantier reserves"`, `20260213082201_remote_schema.sql:1452-1475`) en `to public using (true)`/`with check (true)`. Seul le DELETE est restreint (`chantier_reserves_admin_delete`, lignes 1479-1486, `role = 'ADMIN'`). | Lecture/écriture : **aucune**, ouvert à toute requête authentifiée ou non. Suppression : réservée ADMIN |
| `invoices` | Oui | `invoices_org_select/insert/update/delete` (`20260519090000_business_documents_supabase_v1.sql:104-123`), `to authenticated`, `organization_id = auth.uid()`. | Restriction existante mais **par créateur, pas par rôle ou par entreprise** — aucun bypass ADMIN, aucune différenciation de rôle |
| `chantier_documents` | Oui | `chantier_documents_admin_all` (`for all`, `using(is_admin())`) pour les admins ; `chantier_documents_intervenant_select` (`20260213170000_chantier_documents_rls_prod.sql:56-90`), SELECT seul, exige que `auth.uid()` soit lié à une ligne `intervenant_users` rattachée au chantier **et** que le document soit `visibility_mode = 'GLOBAL'` ou explicitement accordé via `document_access` (admin-only). Anciennes policies permissives de dev explicitement supprimées (lignes 34-45). | **La seule table réellement bien conçue** : accès par rôle, scoping par chantier, granularité par document, appliqué en base — pas seulement masqué côté UI |
| `chantier_time_entries` (temps) | Oui | Une seule policy : `chantier_time_entries_admin_all` (`20260222173000_intervenant_portal_multi_chantiers_v2.sql:105-124`), `for all`, `role = 'ADMIN'` uniquement — aucune policy SELECT/INSERT pour les intervenants. | Écriture réelle des intervenants : via la RPC `intervenant_time_create` (`security definer`), qui **contourne** la RLS de la table après son propre contrôle de jeton. Le `grant select, insert, update ... to authenticated` (ligne 1678) est plus large que ce que permet la policy — inoffensif aujourd'hui uniquement parce que la policy reste admin-only, mais aucune défense en profondeur : un accès direct à la table par un compte authentifié non-admin serait bloqué **par cette seule policy** |

### 4.3 Bilan RLS

La restriction est effectivement appliquée **au niveau base** pour **une seule table** (`chantier_documents`, avec `document_access`), et partiellement pour deux autres (`invoices` — par créateur, pas par rôle ; `chantier_time_entries` — admin-only, l'écriture réelle passe par RPC). Pour `chantiers`, `chantier_tasks` et `chantier_reserves` (lecture/écriture), **n'importe quel utilisateur authentifié a un CRUD complet indépendamment de son rôle**, et `chantier_tasks`/`chantier_reserves` sont même ouvertes au-delà (`anon`/`public`).

**Conclusion centrale : la différenciation de rôle visible côté UI (filtrage Sidebar, feature gates) n'est pas garantie par la base pour ces trois tables.** Un utilisateur disposant d'une session valide (ou, pour tâches/réserves, parfois sans aucune session) peut contourner toute restriction du front par un appel API direct.

---

## 5. Synthèse

### 5.1 Schéma du système actuel (approximatif)

```
                         ┌───────────────────────────────────────────┐
                         │              auth.users (Supabase)         │
                         └───────────────────────────────────────────┘
                              │                              │
                    (1:1 obligatoire)                (0:1 optionnel, via
                              │                     intervenant_account_
                              ▼                        invitations)
                    ┌──────────────────┐                    │
                    │     profiles      │                    ▼
                    │ role: text (CHECK)│          ┌──────────────────────┐
                    │  ADMIN / COMMERCIAL│         │     intervenants      │
                    │  CONDUCTEUR /      │         │  user_id NULLABLE      │
                    │  ASSISTANT /       │         │ (peut exister sans     │
                    │  INTERVENANT       │         │  compte auth.users)    │
                    │ feature_permissions │         └──────────────────────┘
                    │  (jsonb, par user) │                    ▲
                    └──────────────────┘                     │
                              │                     jeton magic-link
                    RequireAuth.tsx                  chantier_access
                    (ADMIN uniquement,                (revalidé à
                     sinon déconnexion forcée)          chaque appel RPC)
                              │
                              ▼
                    ┌──────────────────┐
                    │  App back-office   │◄── Sidebar : adminOnly + feature
                    │  (routes admin)    │    (company module) + permissionKey
                    └──────────────────┘        (profile_permission_presets,
                                                  copiés dans feature_permissions,
                                                  pas de lien persistant au preset)

        ┌───────────────────┐   ┌───────────────────┐   ┌───────────────────┐
        │ Portail intervenant│   │  Portail apporteur │   │  Portail document  │
        │ 2 flux : token brut│   │ apporteur_access +  │   │  client (token de   │
        │ (chantier_access)  │   │ edge function       │   │  workflow, distinct) │
        │ OU vrai compte Auth│   │ → émet un JWT        │   │                     │
        └───────────────────┘   └───────────────────┘   └───────────────────┘

RLS en base : bien appliquée seulement pour chantier_documents (+ document_access).
              Ouverte (using(true), parfois même à anon) pour chantiers,
              chantier_tasks, chantier_reserves. Par créateur (pas par rôle)
              pour invoices. Admin-only + bypass RPC pour chantier_time_entries.
```

### 5.2 Incohérences ou doublons détectés

1. **Rôle base (`profiles.role`, 5 valeurs) vs rôle front (binaire admin/non-admin)** : `COMMERCIAL`, `CONDUCTEUR`, `ASSISTANT` existent en base mais n'ouvrent l'accès à rien — `RequireAuth` exige `ADMIN` sans exception. Ces rôles sont aujourd'hui morts en pratique.
2. **Deux catalogues de rôles qui ne se recoupent pas** : `profiles.role` (5 valeurs, dont `COMMERCIAL`/`CONDUCTEUR`/`ASSISTANT`) vs `BusinessProfilePresetId` (7 valeurs, dont `comptable`, absent du premier catalogue).
3. **`document_access` et `document_permissions`** : même finalité (octroi d'accès document ↔ intervenant), écrites en parallèle pour le même document dans `taskDocuments.service.ts`, sans que l'une ne remplace l'autre.
4. **Deux fonctions d'aide RLS « admin » identiques** (`is_admin()` et `batipro_is_admin()`), plus plusieurs vérifications `exists (select 1 from profiles ...)` réécrites en ligne — pas de source de vérité unique, et un précédent de casse silencieuse lors d'un `create or replace`.
5. **Quatre architectures de jeton différentes** pour quatre portails (jeton brut revalidé par RPC, vrai compte Auth, JWT émis par edge function, jeton de workflow document), sans abstraction commune — chacune a sa propre logique d'expiration/révocation à maintenir séparément.
6. **Presets de permissions non liés durablement à l'utilisateur** : appliquer un preset copie l'état à l'instant T dans `profiles.feature_permissions` ; modifier le preset ensuite ne se répercute pas sur les utilisateurs déjà configurés.
7. **`organization_id` = créateur, pas entreprise** : deux comptes ADMIN ne partagent pas la visibilité sur `invoices`/`purchase_orders`/`product_catalog`/`reception_reports` — à traiter avant d'introduire des rôles multiples qui doivent typiquement partager la même vue d'entreprise.
8. **`RequireCompanyFeature` échoue ouvert** en cas d'erreur de vérification (`allowed: true` par défaut) — acceptable pour la disponibilité, mais à connaître explicitement en concevant un système où le rôle doit réellement borner l'accès.
9. **`VITE_ADMIN_EMAILS`** : liste blanche d'e-mails admin exposée côté client (bundle JS) — à ne pas reconduire telle quelle dans le nouveau système.

### 5.3 Ce qui peut servir de base au futur système de rôles personnalisables

- **`profile_permission_presets` / `BusinessProfilePresetId`** (§1.2, §3.5) : le catalogue de rôles métier (dirigeant, commercial, conducteur de travaux, comptable, administratif, intervenant terrain, sous-traitant) et l'éditeur de permissions par preset (`ProfileAccessPresetsPage.tsx`) existent déjà, sont branchés sur de vraies tables Supabase, et couvrent presque exactement le besoin exprimé. Le travail restant est surtout : (a) lier durablement un utilisateur à son preset plutôt que de copier un instantané, (b) étendre `profiles.role` ou le remplacer par une référence au preset, (c) faire dépendre `RequireAuth`/les routes de ce lien plutôt que d'un simple `role === 'ADMIN'`.
- **Le modèle RLS de `chantier_documents`** (§4.2) : c'est la seule table où rôle + portée (chantier, visibilité) sont réellement appliqués en base, avec un existant testé (policies dédiées, ancien état permissif explicitement supprimé). Ce pattern (policy admin `for all` + policy rôle-spécifique `SELECT`-only scoping via une table de liaison + table de grant explicite) est directement réutilisable pour étendre la RLS aux autres tables.
- **`hasProfileFeaturePermission` + les ~34 clés de `ProfileFeaturePermissions`** : la granularité de permission par fonctionnalité existe déjà côté front et peut nourrir la matrice de droits par rôle personnalisé.
- **Le mécanisme de jeton `chantier_access`/`apporteur_access`** (même forme : token/expires_at/revoked_at/used_at) : une base commune pour un futur système de lien d'invitation unifié, si on choisit de le généraliser plutôt que de le remplacer par de l'auth Supabase classique.

### 5.4 Ce qui devrait être déprécié

- **Les policies RLS permissives `using (true)` / `to anon, authenticated`** sur `chantiers`, `chantier_tasks`, `chantier_reserves` (lecture/écriture) — à remplacer avant tout déploiement avec de vrais utilisateurs, indépendamment même du futur système de rôles : c'est le point le plus urgent de tout cet audit.
- **`document_permissions`** au profit de `document_access` (ou l'inverse, mais pas les deux) — choisir une seule table de grant document.
- **Une des deux fonctions `is_admin()` / `batipro_is_admin()`** — n'en garder qu'une, `security definer` + `set search_path` explicite pour éviter la régression déjà survenue une fois.
- **`profiles.role` en `text` + `CHECK`** — à remplacer par une référence stricte vers le futur catalogue de rôles/presets (clé étrangère ou enum), pour éliminer le flou actuel entre les 5 valeurs base et les 7 valeurs preset.
- **`VITE_ADMIN_EMAILS`** — mécanisme de secours à ne pas reconduire dans la conception cible (expose la liste d'admins côté client, contourne la base).
- **Le doublon de flux d'authentification intervenant** (jeton brut vs compte Auth réel, §2.2/§3.6) — à terme, converger vers un seul mécanisme (probablement le compte Auth réel, plus cohérent avec un système de rôles unifié) plutôt que maintenir les deux indéfiniment.
- **`organization_id = auth.uid()`** comme substitut de multi-tenancy — à remplacer par un vrai id d'entreprise partagé avant d'introduire plusieurs rôles censés voir les mêmes données.

---

*Document produit par audit automatisé en lecture seule (grep + lecture de migrations + lecture de services front). Aucune ligne de code, migration ou policy n'a été modifiée pour le produire.*
