-- Storage policies for chantier documents (PRIVATE bucket + RLS-aware access)

update storage.buckets
set public = false
where id = 'chantier-documents';

drop policy if exists "storage_documents_admin_all" on storage.objects;
drop policy if exists "storage_documents_intervenant_select" on storage.objects;

create policy "storage_documents_admin_all"
  on storage.objects
  for all
  to authenticated
  using (bucket_id = 'chantier-documents' and public.is_admin())
  with check (bucket_id = 'chantier-documents' and public.is_admin());

create policy "storage_documents_intervenant_select"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'chantier-documents'
    and exists (
      select 1
      from public.chantier_documents cd
      join public.intervenant_users iu on iu.user_id = auth.uid()
      where (
        cd.id = (
          case
            when split_part(name, '/', 2) ~* '^[0-9a-f-]{36}$'
            then split_part(name, '/', 2)::uuid
            else null
          end
        )
        or cd.storage_path = name
      )
      and (
        exists (
          select 1
          from public.chantier_intervenants ci
          where ci.chantier_id = cd.chantier_id
            and ci.intervenant_id = iu.intervenant_id
        )
        or exists (
          select 1
          from public.intervenant_chantiers ic
          where ic.chantier_id = cd.chantier_id
            and ic.intervenant_id = iu.intervenant_id
        )
      )
      and (
        cd.visibility_mode = 'GLOBAL'
        or exists (
          select 1
          from public.document_access da
          where da.document_id = cd.id
            and da.intervenant_id = iu.intervenant_id
        )
      )
    )
  );
