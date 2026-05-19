do $$
begin
  -- This migration is intentionally resilient: some legacy tables may be owned
  -- by supabase_admin on existing projects and cannot be altered by postgres.
  -- In that case we keep the migration deployable and emit a notice so the
  -- remaining tables can be handled with an owner/admin migration.
  if to_regclass('public.chantiers') is not null then
    begin
      alter table public.chantiers enable row level security;

      drop policy if exists chantiers_auth_select on public.chantiers;
      drop policy if exists chantiers_auth_insert on public.chantiers;
      drop policy if exists chantiers_auth_update on public.chantiers;
      drop policy if exists chantiers_auth_delete on public.chantiers;

      create policy chantiers_auth_select
        on public.chantiers for select
        to authenticated
        using (true);

      create policy chantiers_auth_insert
        on public.chantiers for insert
        to authenticated
        with check (true);

      create policy chantiers_auth_update
        on public.chantiers for update
        to authenticated
        using (true)
        with check (true);

      create policy chantiers_auth_delete
        on public.chantiers for delete
        to authenticated
        using (true);

      grant select, insert, update, delete on table public.chantiers to authenticated;
    exception
      when insufficient_privilege then
        raise notice 'Skipping RLS for public.chantiers: insufficient privileges.';
    end;
  end if;

  if to_regclass('public.devis') is not null then
    begin
      alter table public.devis enable row level security;

      drop policy if exists devis_auth_select on public.devis;
      drop policy if exists devis_auth_insert on public.devis;
      drop policy if exists devis_auth_update on public.devis;
      drop policy if exists devis_auth_delete on public.devis;

      create policy devis_auth_select
        on public.devis for select
        to authenticated
        using (chantier_id is null or exists (
          select 1 from public.chantiers c where c.id = devis.chantier_id
        ));

      create policy devis_auth_insert
        on public.devis for insert
        to authenticated
        with check (chantier_id is null or exists (
          select 1 from public.chantiers c where c.id = devis.chantier_id
        ));

      create policy devis_auth_update
        on public.devis for update
        to authenticated
        using (chantier_id is null or exists (
          select 1 from public.chantiers c where c.id = devis.chantier_id
        ))
        with check (chantier_id is null or exists (
          select 1 from public.chantiers c where c.id = devis.chantier_id
        ));

      create policy devis_auth_delete
        on public.devis for delete
        to authenticated
        using (chantier_id is null or exists (
          select 1 from public.chantiers c where c.id = devis.chantier_id
        ));

      grant select, insert, update, delete on table public.devis to authenticated;
    exception
      when insufficient_privilege then
        raise notice 'Skipping RLS for public.devis: insufficient privileges.';
    end;
  end if;

  if to_regclass('public.devis_lignes') is not null then
    begin
      alter table public.devis_lignes enable row level security;

      drop policy if exists devis_lignes_auth_select on public.devis_lignes;
      drop policy if exists devis_lignes_auth_insert on public.devis_lignes;
      drop policy if exists devis_lignes_auth_update on public.devis_lignes;
      drop policy if exists devis_lignes_auth_delete on public.devis_lignes;

      create policy devis_lignes_auth_select
        on public.devis_lignes for select
        to authenticated
        using (exists (
          select 1 from public.devis d where d.id = devis_lignes.devis_id
        ));

      create policy devis_lignes_auth_insert
        on public.devis_lignes for insert
        to authenticated
        with check (exists (
          select 1 from public.devis d where d.id = devis_lignes.devis_id
        ));

      create policy devis_lignes_auth_update
        on public.devis_lignes for update
        to authenticated
        using (exists (
          select 1 from public.devis d where d.id = devis_lignes.devis_id
        ))
        with check (exists (
          select 1 from public.devis d where d.id = devis_lignes.devis_id
        ));

      create policy devis_lignes_auth_delete
        on public.devis_lignes for delete
        to authenticated
        using (exists (
          select 1 from public.devis d where d.id = devis_lignes.devis_id
        ));

      grant select, insert, update, delete on table public.devis_lignes to authenticated;
    exception
      when insufficient_privilege then
        raise notice 'Skipping RLS for public.devis_lignes: insufficient privileges.';
    end;
  end if;

  if to_regclass('public.devis_lines') is not null then
    begin
      alter table public.devis_lines enable row level security;

      drop policy if exists devis_lines_auth_select on public.devis_lines;
      drop policy if exists devis_lines_auth_insert on public.devis_lines;
      drop policy if exists devis_lines_auth_update on public.devis_lines;
      drop policy if exists devis_lines_auth_delete on public.devis_lines;

      create policy devis_lines_auth_select
        on public.devis_lines for select
        to authenticated
        using (exists (
          select 1 from public.devis d where d.id = devis_lines.devis_id
        ));

      create policy devis_lines_auth_insert
        on public.devis_lines for insert
        to authenticated
        with check (exists (
          select 1 from public.devis d where d.id = devis_lines.devis_id
        ));

      create policy devis_lines_auth_update
        on public.devis_lines for update
        to authenticated
        using (exists (
          select 1 from public.devis d where d.id = devis_lines.devis_id
        ))
        with check (exists (
          select 1 from public.devis d where d.id = devis_lines.devis_id
        ));

      create policy devis_lines_auth_delete
        on public.devis_lines for delete
        to authenticated
        using (exists (
          select 1 from public.devis d where d.id = devis_lines.devis_id
        ));

      grant select, insert, update, delete on table public.devis_lines to authenticated;
    exception
      when insufficient_privilege then
        raise notice 'Skipping RLS for public.devis_lines: insufficient privileges.';
    end;
  end if;

  if to_regclass('public.intervenants') is not null then
    begin
      alter table public.intervenants enable row level security;

      drop policy if exists intervenants_auth_select on public.intervenants;
      drop policy if exists intervenants_auth_insert on public.intervenants;
      drop policy if exists intervenants_auth_update on public.intervenants;
      drop policy if exists intervenants_auth_delete on public.intervenants;

      create policy intervenants_auth_select
        on public.intervenants for select
        to authenticated
        using (chantier_id is null or exists (
          select 1 from public.chantiers c where c.id = intervenants.chantier_id
        ));

      create policy intervenants_auth_insert
        on public.intervenants for insert
        to authenticated
        with check (chantier_id is null or exists (
          select 1 from public.chantiers c where c.id = intervenants.chantier_id
        ));

      create policy intervenants_auth_update
        on public.intervenants for update
        to authenticated
        using (chantier_id is null or exists (
          select 1 from public.chantiers c where c.id = intervenants.chantier_id
        ))
        with check (chantier_id is null or exists (
          select 1 from public.chantiers c where c.id = intervenants.chantier_id
        ));

      create policy intervenants_auth_delete
        on public.intervenants for delete
        to authenticated
        using (chantier_id is null or exists (
          select 1 from public.chantiers c where c.id = intervenants.chantier_id
        ));

      grant select, insert, update, delete on table public.intervenants to authenticated;
    exception
      when insufficient_privilege then
        raise notice 'Skipping RLS for public.intervenants: insufficient privileges.';
    end;
  end if;

  if to_regclass('public.materiel_demandes') is not null then
    begin
      alter table public.materiel_demandes enable row level security;

      drop policy if exists materiel_demandes_auth_select on public.materiel_demandes;
      drop policy if exists materiel_demandes_auth_insert on public.materiel_demandes;
      drop policy if exists materiel_demandes_auth_update on public.materiel_demandes;
      drop policy if exists materiel_demandes_auth_delete on public.materiel_demandes;

      create policy materiel_demandes_auth_select
        on public.materiel_demandes for select
        to authenticated
        using (exists (
          select 1 from public.chantiers c where c.id = materiel_demandes.chantier_id
        ));

      create policy materiel_demandes_auth_insert
        on public.materiel_demandes for insert
        to authenticated
        with check (exists (
          select 1 from public.chantiers c where c.id = materiel_demandes.chantier_id
        ));

      create policy materiel_demandes_auth_update
        on public.materiel_demandes for update
        to authenticated
        using (exists (
          select 1 from public.chantiers c where c.id = materiel_demandes.chantier_id
        ))
        with check (exists (
          select 1 from public.chantiers c where c.id = materiel_demandes.chantier_id
        ));

      create policy materiel_demandes_auth_delete
        on public.materiel_demandes for delete
        to authenticated
        using (exists (
          select 1 from public.chantiers c where c.id = materiel_demandes.chantier_id
        ));

      grant select, insert, update, delete on table public.materiel_demandes to authenticated;
    exception
      when insufficient_privilege then
        raise notice 'Skipping RLS for public.materiel_demandes: insufficient privileges.';
    end;
  end if;

  if to_regclass('public.chantier_access') is not null then
    begin
      alter table public.chantier_access enable row level security;

      drop policy if exists chantier_access_auth_select on public.chantier_access;
      drop policy if exists chantier_access_auth_insert on public.chantier_access;
      drop policy if exists chantier_access_auth_update on public.chantier_access;
      drop policy if exists chantier_access_auth_delete on public.chantier_access;

      create policy chantier_access_auth_select
        on public.chantier_access for select
        to authenticated
        using (true);

      create policy chantier_access_auth_insert
        on public.chantier_access for insert
        to authenticated
        with check (true);

      create policy chantier_access_auth_update
        on public.chantier_access for update
        to authenticated
        using (true)
        with check (true);

      create policy chantier_access_auth_delete
        on public.chantier_access for delete
        to authenticated
        using (true);

      grant select, insert, update, delete on table public.chantier_access to authenticated;
    exception
      when insufficient_privilege then
        raise notice 'Skipping RLS for public.chantier_access: insufficient privileges.';
    end;
  end if;
end $$;
