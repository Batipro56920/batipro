-- ============================================================================
-- PHASE A — LOT 2 — FERMETURE RLS — ROLLBACK, NON APPLIQUÉ
-- ============================================================================
-- Réplique fidèle des policies capturées EN DIRECT sur le projet
-- (vhwtpwmzaidmlvqcyfep) via pg_policies avant toute modification, le
-- 2026-08-24. À exécuter uniquement si le DRAFT ci-contre a été appliqué et
-- doit être défait. Ne restaure PAS le Lot 1 (organizations / profiles.
-- organization_id) — ce lot reste en place, déjà vérifié en production.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- GROUPE B — restaurer les 41 tables du cluster CRM/devis/factures/apporteurs
-- ----------------------------------------------------------------------------
-- Revert data : avant migration, TOUTES les lignes existantes portaient la
-- même valeur unique 293a4887-e953-4053-a422-ca50c72546a9 (compte admin,
-- vérifié en direct le 2026-08-24) — restauration exacte, pas une supposition.
do $$
declare
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
  foreach v_table in array v_tables loop
    execute format('update public.%I set organization_id = %L', v_table, '293a4887-e953-4053-a422-ca50c72546a9'::uuid);
    execute format('alter table public.%I alter column organization_id set default auth.uid()', v_table);

    for v_pol in select policyname from pg_policies where schemaname = 'public' and tablename = v_table loop
      execute format('drop policy if exists %I on public.%I', v_pol.policyname, v_table);
    end loop;
  end loop;
end $$;

-- Policies d'origine (4 séparées, organization_id = auth.uid(), to authenticated).
-- Trois formats de nom coexistaient réellement (vérifiés en direct, pas déduits) :
--   "_own_org"  : crm_sources, crm_tags, crm_pipeline_stages, crm_clients,
--                 crm_prospects, crm_opportunities, crm_quotes, crm_quote_items,
--                 crm_tasks, crm_appointments, crm_documents, crm_notes,
--                 crm_communications, crm_invoices, crm_sav, crm_visit_reports,
--                 crm_visit_report_items, crm_visit_report_attachments
--   "_own"      : company_settings, suppliers, profile_permission_presets,
--                 apporteurs_affaires
--   "_org_<verb>" (préfixe, pas suffixe) : invoices, purchase_orders,
--                 product_catalog_items, reception_reports
do $$
declare
  v_table text;
  v_tables text[] := array[
    'crm_sources','crm_tags','crm_pipeline_stages','crm_clients','crm_prospects',
    'crm_opportunities','crm_quotes','crm_quote_items','crm_tasks','crm_appointments',
    'crm_documents','crm_notes','crm_communications','crm_invoices','crm_sav',
    'crm_visit_reports','crm_visit_report_items','crm_visit_report_attachments'
  ];
begin
  foreach v_table in array v_tables loop
    execute format('create policy %I on public.%I for select to authenticated using (organization_id = auth.uid())', v_table || '_select_own_org', v_table);
    execute format('create policy %I on public.%I for insert to authenticated with check (organization_id = auth.uid())', v_table || '_insert_own_org', v_table);
    execute format('create policy %I on public.%I for update to authenticated using (organization_id = auth.uid()) with check (organization_id = auth.uid())', v_table || '_update_own_org', v_table);
    execute format('create policy %I on public.%I for delete to authenticated using (organization_id = auth.uid())', v_table || '_delete_own_org', v_table);
  end loop;
end $$;

do $$
declare
  v_table text;
  v_tables text[] := array['company_settings','suppliers','profile_permission_presets','apporteurs_affaires'];
begin
  foreach v_table in array v_tables loop
    execute format('create policy %I on public.%I for select to authenticated using (organization_id = auth.uid())', v_table || '_select_own', v_table);
    execute format('create policy %I on public.%I for insert to authenticated with check (organization_id = auth.uid())', v_table || '_insert_own', v_table);
    execute format('create policy %I on public.%I for update to authenticated using (organization_id = auth.uid()) with check (organization_id = auth.uid())', v_table || '_update_own', v_table);
    execute format('create policy %I on public.%I for delete to authenticated using (organization_id = auth.uid())', v_table || '_delete_own', v_table);
  end loop;
end $$;

do $$
declare
  v_table text;
  v_tables text[] := array['invoices','purchase_orders','product_catalog_items','reception_reports'];
begin
  foreach v_table in array v_tables loop
    execute format('create policy %I on public.%I for select to authenticated using (organization_id = auth.uid())', v_table || '_org_select', v_table);
    execute format('create policy %I on public.%I for insert to authenticated with check (organization_id = auth.uid())', v_table || '_org_insert', v_table);
    execute format('create policy %I on public.%I for update to authenticated using (organization_id = auth.uid()) with check (organization_id = auth.uid())', v_table || '_org_update', v_table);
    execute format('create policy %I on public.%I for delete to authenticated using (organization_id = auth.uid())', v_table || '_org_delete', v_table);
  end loop;
end $$;

-- Policies d'origine (1 seule policy ALL) :
create policy crm_quote_lots_own_org on public.crm_quote_lots for all to authenticated using (organization_id = auth.uid()) with check (organization_id = auth.uid());
create policy crm_quote_resources_own_org on public.crm_quote_resources for all to authenticated using (organization_id = auth.uid()) with check (organization_id = auth.uid());
create policy crm_quote_sections_own_org on public.crm_quote_sections for all to authenticated using (organization_id = auth.uid()) with check (organization_id = auth.uid());
create policy crm_quote_components_own_org on public.crm_quote_components for all to authenticated using (organization_id = auth.uid()) with check (organization_id = auth.uid());
create policy crm_quote_revisions_own_org on public.crm_quote_revisions for all to authenticated using (organization_id = auth.uid()) with check (organization_id = auth.uid());
create policy crm_quote_signatures_own_org on public.crm_quote_signatures for all to authenticated using (organization_id = auth.uid()) with check (organization_id = auth.uid());
create policy crm_payment_terms_own_org on public.crm_payment_terms for all to authenticated using (organization_id = auth.uid()) with check (organization_id = auth.uid());
create policy crm_purchases_own_org on public.crm_purchases for all to authenticated using (organization_id = auth.uid()) with check (organization_id = auth.uid());

-- Policies d'origine (1 seule policy ALL, role "public" -- restaurées à l'identique) :
create policy quote_library_items_org_access on public.quote_library_items for all to public using (organization_id = auth.uid()) with check (organization_id = auth.uid());
create policy quote_library_templates_org_access on public.quote_library_templates for all to public using (organization_id = auth.uid()) with check (organization_id = auth.uid());
create policy quote_imports_org_access on public.quote_imports for all to public using (organization_id = auth.uid()) with check (organization_id = auth.uid());
create policy quote_favorites_org_access on public.quote_favorites for all to public using (organization_id = auth.uid()) with check (organization_id = auth.uid());
create policy company_quote_settings_org_access on public.company_quote_settings for all to public using (organization_id = auth.uid()) with check (organization_id = auth.uid());

-- apporteur_leads / apporteur_documents : ORIGINE = aucune policy (deny-all).
-- Rien à recréer ici : le drop dynamique ci-dessus suffit à revenir à l'état
-- d'origine (RLS activée, zéro policy).


-- ----------------------------------------------------------------------------
-- GROUPE A — restaurer chantiers / chantier_tasks / chantier_reserves / materiel_demandes
-- ----------------------------------------------------------------------------

-- --- chantier_reserves : recréer les 3 policies ouvertes retirées ---------
create policy "Allow write chantier reserves" on public.chantier_reserves for insert to public with check (true);
create policy "Allow read chantier reserves" on public.chantier_reserves for select to public using (true);
create policy "Allow update chantier reserves" on public.chantier_reserves for update to public using (true);

-- --- materiel_demandes : restaurer l'état d'origine (chaotique mais réel) --
drop policy if exists materiel_demandes_admin_all on public.materiel_demandes;
create policy "delete materiel_demandes" on public.materiel_demandes for delete to public using (true);
create policy materiel_demandes_auth_delete on public.materiel_demandes for delete to authenticated using (exists (select 1 from chantiers c where c.id = materiel_demandes.chantier_id));
create policy materiel_demandes_delete_auth on public.materiel_demandes for delete to authenticated using (true);
create policy "insert materiel_demandes" on public.materiel_demandes for insert to public with check (true);
create policy materiel_demandes_auth_insert on public.materiel_demandes for insert to authenticated with check (exists (select 1 from chantiers c where c.id = materiel_demandes.chantier_id));
create policy materiel_demandes_insert_auth on public.materiel_demandes for insert to authenticated with check (true);
create policy materiel_demandes_auth_select on public.materiel_demandes for select to authenticated using (exists (select 1 from chantiers c where c.id = materiel_demandes.chantier_id));
create policy materiel_demandes_select_auth on public.materiel_demandes for select to authenticated using (true);
create policy "read materiel_demandes" on public.materiel_demandes for select to public using (true);
create policy materiel_demandes_auth_update on public.materiel_demandes for update to authenticated using (exists (select 1 from chantiers c where c.id = materiel_demandes.chantier_id)) with check (exists (select 1 from chantiers c where c.id = materiel_demandes.chantier_id));
create policy materiel_demandes_update_auth on public.materiel_demandes for update to authenticated using (true) with check (true);
create policy "update materiel_demandes" on public.materiel_demandes for update to public using (true) with check (true);

-- --- chantier_tasks : restaurer l'état d'origine ---------------------------
drop policy if exists chantier_tasks_admin_all on public.chantier_tasks;
drop policy if exists tasks_select_intervenant on public.chantier_tasks;
create policy "delete chantier_tasks" on public.chantier_tasks for delete to anon, authenticated using (true);
create policy "insert chantier_tasks" on public.chantier_tasks for insert to anon, authenticated with check (true);
create policy "read chantier_tasks" on public.chantier_tasks for select to anon, authenticated using (true);
create policy tasks_select_intervenant on public.chantier_tasks for select to authenticated
  using (exists (select 1 from chantier_task_assignees cta join intervenant_users iu on iu.intervenant_id = cta.intervenant_id where iu.user_id = auth.uid() and cta.task_id = chantier_tasks.id));
create policy "update chantier_tasks" on public.chantier_tasks for update to anon, authenticated using (true) with check (true);

-- --- chantiers : restaurer l'état d'origine (SANS retirer organization_id,
-- qui appartient au Lot 1 déjà en production — seules les policies reviennent) ---
drop policy if exists chantiers_admin_all on public.chantiers;
drop policy if exists chantiers_select_intervenant on public.chantiers;
create policy chantiers_auth_delete on public.chantiers for delete to authenticated using (true);
create policy chantiers_auth_insert on public.chantiers for insert to authenticated with check (true);
create policy "insert chantiers" on public.chantiers for insert to public with check (true);
create policy chantiers_auth_select on public.chantiers for select to authenticated using (true);
create policy chantiers_select_intervenant on public.chantiers for select to authenticated
  using (exists (select 1 from chantier_tasks ct join chantier_task_assignees cta on cta.task_id = ct.id join intervenant_users iu on iu.intervenant_id = cta.intervenant_id where iu.user_id = auth.uid() and ct.chantier_id = chantiers.id));
create policy "read chantiers" on public.chantiers for select to public using (true);
create policy chantiers_auth_update on public.chantiers for update to authenticated using (true) with check (true);


-- ----------------------------------------------------------------------------
-- GROUPE 0 — retirer la fonction et restaurer le grant anon sur organizations
-- ----------------------------------------------------------------------------
grant select on public.organizations to anon;
drop function if exists public.current_organization_id();
