-- Portail sous-traitant.
--
-- Le portail terrain donne déjà au sous-traitant ses tâches, son planning, ses
-- consignes, ses photos et ses réserves. Il lui manquait ce qui fait la relation
-- de sous-traitance elle-même :
--   * les documents que l'entreprise principale doit détenir et renouveler
--     (attestation de vigilance URSSAF tous les 6 mois, Kbis, décennale, RC pro) ;
--   * ses devis, factures et situations de travaux, déposés au lieu d'être
--     envoyés par mail et perdus.
--
-- Le sous-traitant n'a aucun accès direct à ces tables : tout passe par la
-- fonction subcontractor-portal, qui vérifie son identité avec les mêmes règles
-- que le portail terrain (compte connecté ou lien d'accès chantier). Le bureau,
-- lui, y accède normalement.

-- 1. Documents obligatoires ---------------------------------------------------

create table if not exists public.subcontractor_documents (
  id uuid primary key default gen_random_uuid(),
  intervenant_id uuid not null references public.intervenants(id) on delete cascade,
  kind text not null check (kind in ('urssaf_vigilance', 'kbis', 'decennale', 'rc_pro', 'autre')),
  label text,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  storage_path text not null,
  valid_until date,
  status text not null default 'soumis' check (status in ('soumis', 'valide', 'refuse')),
  review_note text,
  reviewed_at timestamptz,
  reviewed_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subcontractor_documents_intervenant_idx
  on public.subcontractor_documents (intervenant_id, kind, created_at desc);

alter table public.subcontractor_documents enable row level security;

drop policy if exists subcontractor_documents_backoffice on public.subcontractor_documents;
create policy subcontractor_documents_backoffice on public.subcontractor_documents
  for all to authenticated
  using (public.is_backoffice())
  with check (public.is_backoffice());

-- 2. Devis, factures et situations -------------------------------------------

create table if not exists public.subcontractor_invoices (
  id uuid primary key default gen_random_uuid(),
  intervenant_id uuid not null references public.intervenants(id) on delete cascade,
  chantier_id uuid references public.chantiers(id) on delete set null,
  kind text not null check (kind in ('devis', 'facture', 'situation')),
  reference text,
  amount_ht numeric(12, 2),
  issued_on date,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  storage_path text not null,
  status text not null default 'soumis' check (status in ('soumis', 'accepte', 'refuse', 'paye')),
  review_note text,
  reviewed_at timestamptz,
  reviewed_by uuid,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subcontractor_invoices_intervenant_idx
  on public.subcontractor_invoices (intervenant_id, created_at desc);

create index if not exists subcontractor_invoices_chantier_idx
  on public.subcontractor_invoices (chantier_id);

alter table public.subcontractor_invoices enable row level security;

drop policy if exists subcontractor_invoices_backoffice on public.subcontractor_invoices;
create policy subcontractor_invoices_backoffice on public.subcontractor_invoices
  for all to authenticated
  using (public.is_backoffice())
  with check (public.is_backoffice());

-- 3. Identité du sous-traitant sur le portail ---------------------------------
--
-- Même vérification que le portail terrain : compte connecté ou lien d'accès.
-- La fonction ne renvoie rien d'autre que ce dont le portail a besoin.

create or replace function public.subcontractor_portal_identity(p_token text)
returns table (
  intervenant_id uuid,
  nom text,
  status text,
  company text,
  email text,
  chantier_ids uuid[]
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ctx record;
begin
  select *
  into v_ctx
  from public._intervenant_token_context_v2(p_token)
  limit 1;

  if v_ctx.intervenant_id is null then
    raise exception 'intervenant_required';
  end if;

  return query
  select
    i.id,
    i.nom::text,
    coalesce(i.status::text, ''),
    coalesce(nullif(btrim(coalesce(i.subcontractor_company, '')), ''), i.entreprise)::text,
    i.email::text,
    coalesce(v_ctx.chantier_ids, '{}'::uuid[])
  from public.intervenants i
  where i.id = v_ctx.intervenant_id;
end;
$$;

revoke all on function public.subcontractor_portal_identity(text) from public;
grant execute on function public.subcontractor_portal_identity(text) to anon, authenticated, service_role;

-- 4. Stockage privé ----------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'subcontractor-files',
  'subcontractor-files',
  false,
  20971520,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Le sous-traitant dépose ses fichiers par la fonction (clé de service) : seul
-- le bureau a besoin d'une règle d'accès direct, pour les consulter.
drop policy if exists storage_subcontractor_files_backoffice on storage.objects;
create policy storage_subcontractor_files_backoffice
  on storage.objects
  for all
  to authenticated
  using (bucket_id = 'subcontractor-files' and public.is_backoffice())
  with check (bucket_id = 'subcontractor-files' and public.is_backoffice());

notify pgrst, 'reload schema';
