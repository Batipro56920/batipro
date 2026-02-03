-- ============================================
-- SEED : Storage buckets (local)
-- ============================================
-- Objectif : aligner le Storage local avec la PROD
-- IMPORTANT : ne pas créer/altérer les policies ici
-- (sinon "must be owner of table storage.objects" en local)

-- Bucket : devis-pdf
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'devis-pdf',
  'devis-pdf',
  false,
  null,   -- limite taille: null = par défaut
  null    -- mime types: null = Any
)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- (Optionnel) Ajoute ici d'autres buckets si besoin, même logique.
-- Exemple :
-- insert into storage.buckets (id, name, public)
-- values ('photos-chantier', 'photos-chantier', false)
-- on conflict (id) do update set public = excluded.public;
