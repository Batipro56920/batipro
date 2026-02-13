-- Baseline for chantier_documents (ensures local/dev migrations can apply)
create table if not exists public.chantier_documents (
  id uuid primary key default gen_random_uuid(),
  chantier_id uuid not null references public.chantiers(id) on delete cascade,
  title text not null,
  file_name text not null,
  storage_path text not null,
  mime_type text null,
  size_bytes bigint null,
  category text not null,
  document_type text not null,
  visibility text not null default 'ADMIN',
  allowed_intervenant_ids uuid[] null,
  uploaded_by_email text null,
  created_at timestamptz not null default now()
);

create index if not exists chantier_documents_chantier_idx
  on public.chantier_documents(chantier_id);

create index if not exists chantier_documents_category_idx
  on public.chantier_documents(category);

create index if not exists chantier_documents_type_idx
  on public.chantier_documents(document_type);
