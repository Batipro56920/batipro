-- Élargit l'accès chantiers/tâches/matériel/réserves au-delà du seul rôle
-- ADMIN, pour que les rôles bureau (COMMERCIAL/CONDUCTEUR/ASSISTANT) voient
-- les chantiers de leur organisation dans la même interface. La restriction
-- fine (financier, etc.) reste gérée par les presets de permissions côté
-- application, comme pour le cluster CRM (Lot 2 Groupe B).
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
      and p.role = any (array['ADMIN','COMMERCIAL','CONDUCTEUR','ASSISTANT'])
  );
$$;

grant execute on function public.is_backoffice() to authenticated;

comment on function public.is_backoffice() is
  'Vrai pour tout compte bureau (ADMIN, COMMERCIAL, CONDUCTEUR, ASSISTANT). Distinct de is_admin() qui reste ADMIN uniquement (gestion des comptes/presets d''autrui).';

drop policy if exists chantiers_admin_all on public.chantiers;
create policy chantiers_admin_all
  on public.chantiers
  for all
  to authenticated
  using (public.is_backoffice() and organization_id = (select public.current_organization_id()))
  with check (public.is_backoffice() and organization_id = (select public.current_organization_id()));

drop policy if exists chantier_tasks_admin_all on public.chantier_tasks;
create policy chantier_tasks_admin_all
  on public.chantier_tasks
  for all
  to authenticated
  using (
    public.is_backoffice()
    and public.chantier_organization_id(chantier_id) = (select public.current_organization_id())
  )
  with check (
    public.is_backoffice()
    and public.chantier_organization_id(chantier_id) = (select public.current_organization_id())
  );

drop policy if exists materiel_demandes_admin_all on public.materiel_demandes;
create policy materiel_demandes_admin_all
  on public.materiel_demandes
  for all
  to authenticated
  using (
    public.is_backoffice()
    and public.chantier_organization_id(chantier_id) = (select public.current_organization_id())
  )
  with check (
    public.is_backoffice()
    and public.chantier_organization_id(chantier_id) = (select public.current_organization_id())
  );

drop policy if exists chantier_reserves_admin_select on public.chantier_reserves;
create policy chantier_reserves_admin_select
  on public.chantier_reserves
  for select
  to authenticated
  using (public.is_backoffice());

drop policy if exists chantier_reserves_admin_insert on public.chantier_reserves;
create policy chantier_reserves_admin_insert
  on public.chantier_reserves
  for insert
  to authenticated
  with check (public.is_backoffice());

drop policy if exists chantier_reserves_admin_update on public.chantier_reserves;
create policy chantier_reserves_admin_update
  on public.chantier_reserves
  for update
  to authenticated
  using (public.is_backoffice())
  with check (public.is_backoffice());

drop policy if exists chantier_reserves_admin_delete on public.chantier_reserves;
create policy chantier_reserves_admin_delete
  on public.chantier_reserves
  for delete
  to authenticated
  using (public.is_backoffice());
