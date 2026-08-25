-- Refonte accès bureau : profiles.role passe de 5 valeurs (ADMIN, COMMERCIAL,
-- CONDUCTEUR, ASSISTANT, INTERVENANT) à 3 (ADMIN, BUREAU, INTERVENANT) — aucun
-- code front/back ne distinguait déjà COMMERCIAL/CONDUCTEUR/ASSISTANT entre
-- eux. La vraie limitation d'accès par poste devient une liste simple de
-- catégories de sidebar autorisées (allowed_sidebar_groups), au lieu du
-- système à ~40 clés de permissions fines (conservé en base mais plus utilisé
-- pour piloter la Sidebar).

alter table public.profiles
  add column if not exists allowed_sidebar_groups text[];

comment on column public.profiles.allowed_sidebar_groups is
  'Catégories de la Sidebar (Pilotage/Commerce/Production/Ressources/Achats/Financier/Paramètres) visibles pour ce compte bureau. NULL = accès complet (utilisé pour ADMIN).';

-- Élargir la contrainte AVANT la migration de données (sinon BUREAU est
-- rejeté par l'ancienne contrainte à 5 valeurs).
alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role = any (array['ADMIN','BUREAU','COMMERCIAL','CONDUCTEUR','ASSISTANT','INTERVENANT']));

update public.profiles
set role = 'BUREAU'
where role in ('COMMERCIAL', 'CONDUCTEUR', 'ASSISTANT');

update public.profiles
set allowed_sidebar_groups = array['Pilotage','Commerce','Production','Ressources','Achats','Paramètres']
where id = 'b10116e1-88d2-43cc-b72e-5949835a8b61';

-- Resserrer la contrainte à sa forme finale une fois la donnée migrée.
alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role = any (array['ADMIN','BUREAU','INTERVENANT']));

create or replace function public.is_backoffice()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = any (array['ADMIN','BUREAU'])
  );
$$;

comment on function public.is_backoffice() is
  'Vrai pour tout compte bureau (ADMIN, BUREAU). Distinct de is_admin() qui reste ADMIN uniquement (gestion des comptes/droits d''autrui).';

create or replace function public.batipro_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_admin();
$$;

drop policy if exists chantier_zones_admin_all on public.chantier_zones;
create policy chantier_zones_admin_all on public.chantier_zones for all to authenticated
  using (public.is_backoffice()) with check (public.is_backoffice());

drop policy if exists chantier_preparation_checklists_admin_all on public.chantier_preparation_checklists;
create policy chantier_preparation_checklists_admin_all on public.chantier_preparation_checklists for all to authenticated
  using (public.is_backoffice()) with check (public.is_backoffice());

drop policy if exists chantier_photos_admin_all on public.chantier_photos;
create policy chantier_photos_admin_all on public.chantier_photos for all to authenticated
  using (public.is_backoffice()) with check (public.is_backoffice());

drop policy if exists chantier_purchase_requests_admin_all on public.chantier_purchase_requests;
create policy chantier_purchase_requests_admin_all on public.chantier_purchase_requests for all to authenticated
  using (public.is_backoffice()) with check (public.is_backoffice());

drop policy if exists chantier_task_steps_admin_all on public.chantier_task_steps;
create policy chantier_task_steps_admin_all on public.chantier_task_steps for all to authenticated
  using (public.is_backoffice()) with check (public.is_backoffice());

drop policy if exists chantier_templates_admin_all on public.chantier_templates;
create policy chantier_templates_admin_all on public.chantier_templates for all to authenticated
  using (public.is_backoffice()) with check (public.is_backoffice());

drop policy if exists chantier_budget_settings_admin_all on public.chantier_budget_settings;
create policy chantier_budget_settings_admin_all on public.chantier_budget_settings for all to authenticated
  using (public.is_backoffice()) with check (public.is_backoffice());

drop policy if exists chantier_activity_log_admin_select on public.chantier_activity_log;
create policy chantier_activity_log_admin_select on public.chantier_activity_log for select to authenticated
  using (public.is_backoffice());

drop policy if exists chantier_task_zones_admin_all on public.chantier_task_zones;
create policy chantier_task_zones_admin_all on public.chantier_task_zones for all to authenticated
  using (public.is_backoffice()) with check (public.is_backoffice());

drop policy if exists doe_requirements_select on public.doe_requirements;
create policy doe_requirements_select on public.doe_requirements for select to authenticated
  using ((task_id is null) or public.batipro_can_access_field_task(task_id) or public.is_backoffice());

drop policy if exists doe_requirements_write on public.doe_requirements;
create policy doe_requirements_write on public.doe_requirements for all to authenticated
  using (public.is_backoffice()) with check (public.is_backoffice());

drop policy if exists field_feedback_select on public.field_feedback;
create policy field_feedback_select on public.field_feedback for select to authenticated
  using ((task_id is null) or public.batipro_can_access_field_task(task_id) or public.is_backoffice());

drop policy if exists field_feedback_write on public.field_feedback;
create policy field_feedback_write on public.field_feedback for all to authenticated
  using ((task_id is null) or public.batipro_can_access_field_task(task_id) or public.is_backoffice())
  with check ((task_id is null) or public.batipro_can_access_field_task(task_id) or public.is_backoffice());

drop policy if exists photo_requirements_write on public.photo_requirements;
create policy photo_requirements_write on public.photo_requirements for all to authenticated
  using (public.is_backoffice()) with check (public.is_backoffice());

drop policy if exists intervenant_account_invitations_admin_select on public.intervenant_account_invitations;
create policy intervenant_account_invitations_admin_select on public.intervenant_account_invitations for select to authenticated
  using (public.is_backoffice());

drop policy if exists intervenant_account_invitations_admin_insert on public.intervenant_account_invitations;
create policy intervenant_account_invitations_admin_insert on public.intervenant_account_invitations for insert to authenticated
  with check (public.is_backoffice());

drop policy if exists intervenant_account_invitations_admin_update on public.intervenant_account_invitations;
create policy intervenant_account_invitations_admin_update on public.intervenant_account_invitations for update to authenticated
  using (public.is_backoffice()) with check (public.is_backoffice());

drop policy if exists intervenant_account_invitations_admin_delete on public.intervenant_account_invitations;
create policy intervenant_account_invitations_admin_delete on public.intervenant_account_invitations for delete to authenticated
  using (public.is_backoffice());

drop policy if exists intervenants_admin_select on public.intervenants;
create policy intervenants_admin_select on public.intervenants for select to authenticated
  using (public.is_backoffice());

drop policy if exists intervenants_admin_insert on public.intervenants;
create policy intervenants_admin_insert on public.intervenants for insert to authenticated
  with check (public.is_backoffice());

drop policy if exists intervenants_admin_update on public.intervenants;
create policy intervenants_admin_update on public.intervenants for update to authenticated
  using (public.is_backoffice()) with check (public.is_backoffice());

drop policy if exists intervenants_admin_delete on public.intervenants;
create policy intervenants_admin_delete on public.intervenants for delete to authenticated
  using (public.is_backoffice());

drop policy if exists knowledge_improvements_admin on public.knowledge_improvements;
create policy knowledge_improvements_admin on public.knowledge_improvements for all to authenticated
  using (public.is_backoffice()) with check (public.is_backoffice());

drop policy if exists knowledge_versions_admin on public.knowledge_versions;
create policy knowledge_versions_admin on public.knowledge_versions for all to authenticated
  using (public.is_backoffice()) with check (public.is_backoffice());

drop policy if exists knowledge_change_audit_admin on public.knowledge_change_audit;
create policy knowledge_change_audit_admin on public.knowledge_change_audit for all to authenticated
  using (public.is_backoffice()) with check (public.is_backoffice());

drop policy if exists knowledge_impact_simulations_admin on public.knowledge_impact_simulations;
create policy knowledge_impact_simulations_admin on public.knowledge_impact_simulations for all to authenticated
  using (public.is_backoffice()) with check (public.is_backoffice());
