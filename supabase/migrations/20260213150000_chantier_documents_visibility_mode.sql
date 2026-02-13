-- Add visibility_mode and access table for chantier documents

create table if not exists public.document_access (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.chantier_documents(id) on delete cascade,
  intervenant_id uuid not null references public.intervenants(id) on delete cascade,
  created_at timestamptz not null default now()
);

create unique index if not exists document_access_document_intervenant_uniq
  on public.document_access(document_id, intervenant_id);

create index if not exists document_access_document_idx
  on public.document_access(document_id);

create index if not exists document_access_intervenant_idx
  on public.document_access(intervenant_id);

alter table public.document_access enable row level security;

alter table public.chantier_documents
  add column if not exists visibility_mode text;

update public.chantier_documents
set visibility_mode = case
  when visibility_mode is not null then visibility_mode
  when visibility = 'CUSTOM' then 'RESTRICTED'
  when visibility = 'ADMIN' then 'RESTRICTED'
  else 'GLOBAL'
end
where visibility_mode is null;

alter table public.chantier_documents
  alter column visibility_mode set default 'GLOBAL';

alter table public.chantier_documents
  alter column visibility_mode set not null;

insert into public.document_access (document_id, intervenant_id)
select cd.id, unnest(cd.allowed_intervenant_ids)
from public.chantier_documents cd
where cd.allowed_intervenant_ids is not null
on conflict do nothing;

-- Drop old permissive policies
 drop policy if exists "auth can insert chantier documents" on public.chantier_documents;
 drop policy if exists "auth can select chantier documents" on public.chantier_documents;
 drop policy if exists "insert chantier_documents if chantier_access_admin" on public.chantier_documents;
 drop policy if exists "select chantier_documents if chantier_access" on public.chantier_documents;

-- Admin full access
create policy "documents_admin_all"
  on public.chantier_documents
  for all
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ADMIN'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ADMIN'));

-- Intervenant read access
create policy "documents_intervenant_select"
  on public.chantier_documents
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.intervenant_users iu
      join public.chantier_intervenants ci on ci.intervenant_id = iu.intervenant_id
      where iu.user_id = auth.uid()
        and ci.chantier_id = chantier_documents.chantier_id
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

-- document_access policies
 drop policy if exists "document_access_admin_all" on public.document_access;
 drop policy if exists "document_access_select_own" on public.document_access;

create policy "document_access_admin_all"
  on public.document_access
  for all
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ADMIN'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ADMIN'));

create policy "document_access_select_own"
  on public.document_access
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.intervenant_users iu
      where iu.user_id = auth.uid()
        and iu.intervenant_id = document_access.intervenant_id
    )
  );
