-- Restore the complete chantier visit-report workflow for back-office users.
-- The visit tables still relied on the historical ADMIN-only policies even
-- though office accounts now use the ADMIN/BUREAU role model.

begin;

drop policy if exists chantier_visites_admin_all on public.chantier_visites;
drop policy if exists chantier_visites_backoffice_all on public.chantier_visites;
create policy chantier_visites_backoffice_all
  on public.chantier_visites
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

drop policy if exists chantier_visite_actions_admin_all on public.chantier_visite_actions;
drop policy if exists chantier_visite_actions_backoffice_all on public.chantier_visite_actions;
create policy chantier_visite_actions_backoffice_all
  on public.chantier_visite_actions
  for all
  to authenticated
  using (
    public.is_backoffice()
    and exists (
      select 1
      from public.chantier_visites visite
      where visite.id = chantier_visite_actions.visite_id
        and public.chantier_organization_id(visite.chantier_id) = (select public.current_organization_id())
    )
  )
  with check (
    public.is_backoffice()
    and exists (
      select 1
      from public.chantier_visites visite
      where visite.id = chantier_visite_actions.visite_id
        and public.chantier_organization_id(visite.chantier_id) = (select public.current_organization_id())
    )
  );

drop policy if exists chantier_visite_participants_admin_all on public.chantier_visite_participants;
drop policy if exists chantier_visite_participants_backoffice_all on public.chantier_visite_participants;
create policy chantier_visite_participants_backoffice_all
  on public.chantier_visite_participants
  for all
  to authenticated
  using (
    public.is_backoffice()
    and exists (
      select 1
      from public.chantier_visites visite
      where visite.id = chantier_visite_participants.visite_id
        and public.chantier_organization_id(visite.chantier_id) = (select public.current_organization_id())
    )
  )
  with check (
    public.is_backoffice()
    and exists (
      select 1
      from public.chantier_visites visite
      where visite.id = chantier_visite_participants.visite_id
        and public.chantier_organization_id(visite.chantier_id) = (select public.current_organization_id())
    )
  );

drop policy if exists chantier_visite_snapshot_admin_all on public.chantier_visite_snapshot;
drop policy if exists chantier_visite_snapshot_backoffice_all on public.chantier_visite_snapshot;
create policy chantier_visite_snapshot_backoffice_all
  on public.chantier_visite_snapshot
  for all
  to authenticated
  using (
    public.is_backoffice()
    and exists (
      select 1
      from public.chantier_visites visite
      where visite.id = chantier_visite_snapshot.visite_id
        and public.chantier_organization_id(visite.chantier_id) = (select public.current_organization_id())
    )
  )
  with check (
    public.is_backoffice()
    and exists (
      select 1
      from public.chantier_visites visite
      where visite.id = chantier_visite_snapshot.visite_id
        and public.chantier_organization_id(visite.chantier_id) = (select public.current_organization_id())
    )
  );

drop policy if exists chantier_visite_documents_admin_all on public.chantier_visite_documents;
drop policy if exists chantier_visite_documents_backoffice_all on public.chantier_visite_documents;
create policy chantier_visite_documents_backoffice_all
  on public.chantier_visite_documents
  for all
  to authenticated
  using (
    public.is_backoffice()
    and exists (
      select 1
      from public.chantier_visites visite
      where visite.id = chantier_visite_documents.visite_id
        and public.chantier_organization_id(visite.chantier_id) = (select public.current_organization_id())
    )
  )
  with check (
    public.is_backoffice()
    and exists (
      select 1
      from public.chantier_visites visite
      where visite.id = chantier_visite_documents.visite_id
        and public.chantier_organization_id(visite.chantier_id) = (select public.current_organization_id())
    )
  );

-- Photos and generated PDFs are chantier documents. Without this policy a
-- BUREAU account can create the visit but cannot attach or export its report.
drop policy if exists chantier_documents_admin_all on public.chantier_documents;
drop policy if exists chantier_documents_backoffice_all on public.chantier_documents;
create policy chantier_documents_backoffice_all
  on public.chantier_documents
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

-- A generated global report may optionally be added to the chantier DOE.
drop policy if exists chantier_doe_items_admin_all on public.chantier_doe_items;
drop policy if exists chantier_doe_items_backoffice_all on public.chantier_doe_items;
create policy chantier_doe_items_backoffice_all
  on public.chantier_doe_items
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

commit;
