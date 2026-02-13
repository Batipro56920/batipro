-- RLS durcie pour documents + document_access (GLOBAL / RESTRICTED)

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'ADMIN'
  );
$$;

create or replace function public.current_intervenant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select iu.intervenant_id
  from public.intervenant_users iu
  where iu.user_id = auth.uid()
  limit 1;
$$;

alter table public.chantier_documents enable row level security;
alter table public.document_access enable row level security;

-- Drop anciennes policies (dev/permissives)
drop policy if exists "auth can insert chantier documents" on public.chantier_documents;
drop policy if exists "auth can select chantier documents" on public.chantier_documents;
drop policy if exists "insert chantier_documents if chantier_access_admin" on public.chantier_documents;
drop policy if exists "select chantier_documents if chantier_access" on public.chantier_documents;
drop policy if exists "documents_admin_all" on public.chantier_documents;
drop policy if exists "documents_intervenant_select" on public.chantier_documents;
drop policy if exists "chantier_documents_admin_all" on public.chantier_documents;
drop policy if exists "chantier_documents_intervenant_select" on public.chantier_documents;

drop policy if exists "document_access_admin_all" on public.document_access;
drop policy if exists "document_access_select_own" on public.document_access;

-- Admin full access
create policy "chantier_documents_admin_all"
  on public.chantier_documents
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Intervenant read access (GLOBAL or RESTRICTED via document_access)
create policy "chantier_documents_intervenant_select"
  on public.chantier_documents
  for select
  to authenticated
  using (
    not public.is_admin()
    and exists (
      select 1
      from public.intervenant_users iu
      where iu.user_id = auth.uid()
        and (
          exists (
            select 1
            from public.chantier_intervenants ci
            where ci.chantier_id = chantier_documents.chantier_id
              and ci.intervenant_id = iu.intervenant_id
          )
          or exists (
            select 1
            from public.intervenant_chantiers ic
            where ic.chantier_id = chantier_documents.chantier_id
              and ic.intervenant_id = iu.intervenant_id
          )
        )
        and (
          chantier_documents.visibility_mode = 'GLOBAL'
          or exists (
            select 1
            from public.document_access da
            where da.document_id = chantier_documents.id
              and da.intervenant_id = iu.intervenant_id
          )
        )
    )
  );

-- document_access admin only
create policy "document_access_admin_all"
  on public.document_access
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
