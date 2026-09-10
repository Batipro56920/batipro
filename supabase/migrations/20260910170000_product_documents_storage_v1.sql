-- Stockage des fiches produits (fiches techniques, notices, FDS, certificats).
-- Jusqu'ici ProductDocument.url etait un champ texte libre : le fichier depose
-- pour analyse Coco n'etait jamais conserve. Ce bucket lui donne un emplacement
-- reel, ce qui permet ensuite de reprendre la piece dans le DOE chantier.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-documents',
  'product-documents',
  false,
  20971520,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'text/plain',
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "storage_product_documents_admin_all" on storage.objects;
drop policy if exists "storage_product_documents_read" on storage.objects;

create policy "storage_product_documents_admin_all"
  on storage.objects
  for all
  to authenticated
  using (bucket_id = 'product-documents' and public.is_admin())
  with check (bucket_id = 'product-documents' and public.is_admin());

-- Les fiches produits servent aussi sur le terrain (case "Visible dans la tache
-- terrain") : lecture ouverte aux comptes authentifies, ecriture reservee au
-- back-office par la politique ci-dessus.
create policy "storage_product_documents_read"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'product-documents');
