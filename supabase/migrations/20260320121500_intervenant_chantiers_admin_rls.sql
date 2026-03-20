alter table if exists public.intervenant_chantiers enable row level security;

drop policy if exists intervenant_chantiers_admin_select on public.intervenant_chantiers;
drop policy if exists intervenant_chantiers_admin_insert on public.intervenant_chantiers;
drop policy if exists intervenant_chantiers_admin_update on public.intervenant_chantiers;
drop policy if exists intervenant_chantiers_admin_delete on public.intervenant_chantiers;
drop policy if exists intervenant_chantiers_admin_all on public.intervenant_chantiers;

create policy intervenant_chantiers_admin_select
  on public.intervenant_chantiers
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'ADMIN'
    )
  );

create policy intervenant_chantiers_admin_insert
  on public.intervenant_chantiers
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'ADMIN'
    )
  );

create policy intervenant_chantiers_admin_update
  on public.intervenant_chantiers
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'ADMIN'
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'ADMIN'
    )
  );

create policy intervenant_chantiers_admin_delete
  on public.intervenant_chantiers
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'ADMIN'
    )
  );
