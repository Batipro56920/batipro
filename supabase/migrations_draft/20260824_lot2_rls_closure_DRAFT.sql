-- ============================================================================
-- PHASE A — LOT 2 — FERMETURE RLS — BROUILLON, NON APPLIQUÉ
-- ============================================================================
-- Ce fichier vit hors de supabase/migrations/ (dans migrations_draft/) pour ne
-- jamais être ramassé par la CLI/le tooling de migration comme une migration
-- réelle. Ne pas déplacer dans supabase/migrations/ sans accord explicite,
-- et ne pas appliquer via apply_migration sans confirmation préalable.
--
-- Exclusions volontaires (accès token, ne pas toucher) : apporteur_access,
-- document_client_workflows. Aucune ligne de ce fichier ne les référence.
--
-- Tables déjà correctement fermées, donc AUCUN changement proposé ici :
-- chantier_time_entries (une seule policy admin-only déjà en place),
-- terrain_feedbacks (une seule policy admin-only déjà en place — les écritures
-- du portail terrain passent par la RPC security definer
-- intervenant_terrain_feedback_create, qui contourne cette policy comme prévu).
-- ============================================================================


-- ----------------------------------------------------------------------------
-- GROUPE 0 — Fonction de résolution stable de l'organisation courante
-- ----------------------------------------------------------------------------
-- SECURITY DEFINER : nécessaire pour que la fonction puisse lire la ligne
-- `profiles` de l'appelant même si un futur durcissement de la RLS sur
-- `profiles` restreignait cette lecture (aujourd'hui `profiles_read_own`
-- l'autorise déjà en self-read, mais on ne veut pas que ce helper dépende
-- de cette policy pour rester stable dans le temps).
-- STABLE (pas VOLATILE) : permet à Postgres de traiter l'appel comme un
-- InitPlan à évaluation unique par requête quand il est enveloppé en
-- `(select public.current_organization_id())` dans une policy, plutôt que
-- ré-exécuté ligne par ligne (pattern recommandé par Supabase pour les
-- fonctions d'auth utilisées en RLS).
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

comment on function public.current_organization_id() is
  'Organisation (unique, CB Renovation) de l''utilisateur courant. NULL si non authentifié ou sans profil — toute policy organization_id = (select current_organization_id()) refuse alors l''accès par construction (NULL ne matche jamais).';


-- ----------------------------------------------------------------------------
-- GROUPE 0bis — Nettoyage advisory GraphQL/anon sur organizations (Lot 1)
-- ----------------------------------------------------------------------------
-- La policy `organizations_authenticated_select` (Lot 1) est déjà `to
-- authenticated` uniquement — RLS bloque donc déjà anon. L'advisory Supabase
-- ("visible dans le schéma GraphQL pour anon") vient du GRANT de table par
-- défaut, indépendant de la RLS. On retire ce grant explicitement.
revoke all on public.organizations from anon;


-- ============================================================================
-- GROUPE A — Racine chantiers + tables enfants (via jointure chantier_id)
-- ============================================================================
-- Design : organization_id est ajouté UNIQUEMENT sur `chantiers` (la racine
-- vers laquelle ~60 tables pointent déjà via chantier_id, chantiers ayant été
-- vérifié comme le point de convergence naturel). chantier_tasks,
-- chantier_reserves, materiel_demandes scopent via une jointure chantier_id
-- -> chantiers.organization_id plutôt que de dupliquer la colonne partout.

-- --- A.1 chantiers : nouvelle colonne organization_id ----------------------
alter table public.chantiers
  add column if not exists organization_id uuid references public.organizations(id);

do $$
declare
  v_org_id uuid;
  v_pol record;
begin
  select id into v_org_id from public.organizations order by created_at limit 1;

  update public.chantiers
  set organization_id = v_org_id
  where organization_id is null;

  execute format('alter table public.chantiers alter column organization_id set default %L', v_org_id);
  execute 'alter table public.chantiers alter column organization_id set not null';

  -- Drop de TOUTES les policies existantes sur chantiers (les 3 "using(true)"
  -- ouvertes + les policies authenticated déjà présentes mais tout aussi
  -- ouvertes). chantiers_select_intervenant est recréée à l'identique
  -- juste après, donc rien n'est perdu.
  for v_pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'chantiers' loop
    execute format('drop policy if exists %I on public.chantiers', v_pol.policyname);
  end loop;
end $$;

create policy chantiers_admin_all
  on public.chantiers
  for all
  to authenticated
  using (public.is_admin() and organization_id = (select public.current_organization_id()))
  with check (public.is_admin() and organization_id = (select public.current_organization_id()));

-- Recréée à l'identique de l'existant (même logique, même jointure) :
create policy chantiers_select_intervenant
  on public.chantiers
  for select
  to authenticated
  using (
    exists (
      select 1
      from chantier_tasks ct
      join chantier_task_assignees cta on cta.task_id = ct.id
      join intervenant_users iu on iu.intervenant_id = cta.intervenant_id
      where iu.user_id = auth.uid() and ct.chantier_id = chantiers.id
    )
  );


-- --- A.2 chantier_tasks : scope via jointure chantiers ----------------------
do $$
declare v_pol record;
begin
  for v_pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'chantier_tasks' loop
    execute format('drop policy if exists %I on public.chantier_tasks', v_pol.policyname);
  end loop;
end $$;

create policy chantier_tasks_admin_all
  on public.chantier_tasks
  for all
  to authenticated
  using (
    public.is_admin()
    and exists (
      select 1 from public.chantiers c
      where c.id = chantier_tasks.chantier_id
        and c.organization_id = (select public.current_organization_id())
    )
  )
  with check (
    public.is_admin()
    and exists (
      select 1 from public.chantiers c
      where c.id = chantier_tasks.chantier_id
        and c.organization_id = (select public.current_organization_id())
    )
  );

-- Recréée à l'identique de l'existant :
create policy tasks_select_intervenant
  on public.chantier_tasks
  for select
  to authenticated
  using (
    exists (
      select 1 from chantier_task_assignees cta
      join intervenant_users iu on iu.intervenant_id = cta.intervenant_id
      where iu.user_id = auth.uid() and cta.task_id = chantier_tasks.id
    )
  );


-- --- A.3 chantier_reserves : retrait MINIMAL -------------------------------
-- Les policies admin_* (role ADMIN via profiles) et intervenant_* (email via
-- auth.jwt()) déjà en place sont correctement scopées — seules les 3
-- policies "Allow ... chantier reserves" (to public, using(true)) sont le
-- problème. On les retire nommément, sans toucher au reste.
drop policy if exists "Allow write chantier reserves" on public.chantier_reserves;
drop policy if exists "Allow read chantier reserves" on public.chantier_reserves;
drop policy if exists "Allow update chantier reserves" on public.chantier_reserves;


-- --- A.4 materiel_demandes : scope via jointure chantiers ------------------
-- ⚠️ À VÉRIFIER AVANT APPLICATION : les policies "scopées" existantes
-- (exists (select 1 from chantiers c where c.id = materiel_demandes.chantier_id))
-- ne filtrent en réalité RIEN (vrai pour toute ligne valide) — donc AUCUNE
-- policy actuelle n'est réellement restrictive ici. Avant d'appliquer, il faut
-- confirmer si le portail terrain (EmployeePortalV2Page, "demande matériel")
-- écrit dans cette table via une session authentifiée directe (auquel cas il
-- faut une policy intervenant, sur le modèle de chantier_reserves_intervenant_*)
-- ou exclusivement via une RPC security definer (qui contournerait cette RLS
-- de toute façon, comme pour terrain_feedbacks). Ci-dessous : admin uniquement,
-- à compléter si la vérification montre un besoin d'accès intervenant direct.
do $$
declare v_pol record;
begin
  for v_pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'materiel_demandes' loop
    execute format('drop policy if exists %I on public.materiel_demandes', v_pol.policyname);
  end loop;
end $$;

create policy materiel_demandes_admin_all
  on public.materiel_demandes
  for all
  to authenticated
  using (
    public.is_admin()
    and exists (
      select 1 from public.chantiers c
      where c.id = materiel_demandes.chantier_id
        and c.organization_id = (select public.current_organization_id())
    )
  )
  with check (
    public.is_admin()
    and exists (
      select 1 from public.chantiers c
      where c.id = materiel_demandes.chantier_id
        and c.organization_id = (select public.current_organization_id())
    )
  );


-- ============================================================================
-- GROUPE B — Cluster CRM / devis / factures / apporteurs / paramètres société
-- ============================================================================
-- 41 tables, toutes actuellement organization_id = auth.uid() (créateur) au
-- niveau donnée ET policy (sauf apporteur_leads / apporteur_documents : RLS
-- activée mais AUCUNE policy — donc deny-all total aujourd'hui, y compris pour
-- l'admin ; ce groupe les corrige aussi). Pattern rigoureusement uniforme :
-- on ne devine pas les noms de policies existants (risque de typo), on les
-- lit depuis pg_policies et on les drop dynamiquement avant de recréer 4
-- policies standard par table (select/insert/update/delete, to authenticated,
-- organization_id = current_organization_id()).
do $$
declare
  v_org_id uuid;
  v_table text;
  v_pol record;
  v_tables text[] := array[
    'company_settings','suppliers','crm_sources','crm_tags','crm_pipeline_stages',
    'crm_clients','crm_prospects','crm_opportunities','crm_quotes','crm_quote_items',
    'crm_tasks','crm_appointments','crm_documents','crm_notes','crm_communications',
    'crm_invoices','crm_sav','crm_quote_lots','crm_quote_resources','crm_quote_sections',
    'crm_quote_components','crm_quote_revisions','crm_quote_signatures','crm_payment_terms',
    'crm_purchases','quote_library_items','quote_library_templates','quote_imports',
    'quote_favorites','company_quote_settings','invoices','purchase_orders',
    'product_catalog_items','reception_reports','crm_visit_reports',
    'crm_visit_report_items','crm_visit_report_attachments',
    'apporteurs_affaires','apporteur_leads','apporteur_documents','profile_permission_presets'
  ];
begin
  select id into v_org_id from public.organizations order by created_at limit 1;

  foreach v_table in array v_tables loop
    -- 1. migrer la donnée existante (auth.uid() du créateur -> vraie organisation)
    execute format('update public.%I set organization_id = %L', v_table, v_org_id);

    -- 2. pointer le DEFAULT sur la vraie organisation plutôt que auth.uid()
    execute format('alter table public.%I alter column organization_id set default %L', v_table, v_org_id);

    -- 3. drop de toutes les policies existantes (quel que soit leur nom exact)
    for v_pol in
      select policyname from pg_policies where schemaname = 'public' and tablename = v_table
    loop
      execute format('drop policy if exists %I on public.%I', v_pol.policyname, v_table);
    end loop;

    -- 4. recréer 4 policies standard, authenticated + membre de l'organisation
    execute format(
      'create policy %I on public.%I for select to authenticated using (organization_id = (select public.current_organization_id()))',
      v_table || '_org_select', v_table
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (organization_id = (select public.current_organization_id()))',
      v_table || '_org_insert', v_table
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (organization_id = (select public.current_organization_id())) with check (organization_id = (select public.current_organization_id()))',
      v_table || '_org_update', v_table
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (organization_id = (select public.current_organization_id()))',
      v_table || '_org_delete', v_table
    );
  end loop;
end $$;


-- ============================================================================
-- FIN DU BROUILLON — voir le fichier ROLLBACK associé et
-- docs/lot2-fermeture-rls-brouillon.md pour l'ordre d'application proposé,
-- le détail table par table, et le test de preuve anonyme.
-- ============================================================================
