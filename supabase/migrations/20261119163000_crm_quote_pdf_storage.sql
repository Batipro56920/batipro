-- Dedicated private storage for externally issued CRM quotes (Obat PDFs).
-- Unlike legacy devis-pdf, access is restricted to authenticated back-office
-- users in the organization named by the first folder of the object key.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('crm-quote-pdfs', 'crm-quote-pdfs', false, 20971520, array['application/pdf']::text[])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists crm_quote_pdfs_read_office_org on storage.objects;
create policy crm_quote_pdfs_read_office_org on storage.objects
for select to authenticated
using (
  bucket_id = 'crm-quote-pdfs'
  and public.is_backoffice()
  and (storage.foldername(name))[1] = public.current_organization_id()::text
);

drop policy if exists crm_quote_pdfs_insert_office_org on storage.objects;
create policy crm_quote_pdfs_insert_office_org on storage.objects
for insert to authenticated
with check (
  bucket_id = 'crm-quote-pdfs'
  and public.is_backoffice()
  and (storage.foldername(name))[1] = public.current_organization_id()::text
);

drop policy if exists crm_quote_pdfs_delete_office_org on storage.objects;
create policy crm_quote_pdfs_delete_office_org on storage.objects
for delete to authenticated
using (
  bucket_id = 'crm-quote-pdfs'
  and public.is_backoffice()
  and (storage.foldername(name))[1] = public.current_organization_id()::text
);
