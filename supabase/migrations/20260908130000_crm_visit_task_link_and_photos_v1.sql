-- Visite terrain / chiffrage : rattacher un modèle de tâche à une ligne de
-- pré-devis, et stocker durablement les photos prises pendant le RDV.

-- 1. Lien vers la bibliothèque de tâches.
-- Le libellé est dupliqué : le compte rendu d'une visite passée doit rester
-- lisible même si la tâche est renommée ou supprimée de la bibliothèque.
alter table public.crm_visit_report_items
  add column if not exists task_template_id uuid references public.task_templates(id) on delete set null;

alter table public.crm_visit_report_items
  add column if not exists task_template_label text;

create index if not exists crm_visit_report_items_task_template_id_idx
  on public.crm_visit_report_items (task_template_id);

-- 2. Bucket des pièces jointes de visite.
-- Sans lui, toute photo prise pendant le RDV faisait échouer l'enregistrement
-- complet du compte rendu ("Bucket not found") et était perdue à la fermeture.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'crm-visit-attachments',
  'crm-visit-attachments',
  false,
  26214400,
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
    'application/pdf'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Le chemin de stockage est "<visit_report_id>/<uuid>-<nom>" : on s'appuie sur
-- la RLS de crm_visit_reports plutôt que de la réécrire ici.
drop policy if exists "storage_crm_visit_attachments_all" on storage.objects;

create policy "storage_crm_visit_attachments_all"
  on storage.objects
  for all
  to authenticated
  using (
    bucket_id = 'crm-visit-attachments'
    and exists (
      select 1
      from public.crm_visit_reports r
      where r.id = (
        case
          when split_part(name, '/', 1) ~* '^[0-9a-f-]{36}$'
          then split_part(name, '/', 1)::uuid
          else null
        end
      )
    )
  )
  with check (
    bucket_id = 'crm-visit-attachments'
    and exists (
      select 1
      from public.crm_visit_reports r
      where r.id = (
        case
          when split_part(name, '/', 1) ~* '^[0-9a-f-]{36}$'
          then split_part(name, '/', 1)::uuid
          else null
        end
      )
    )
  );
