-- Table devis_lignes (standard)
create table if not exists public.devis_lignes (
  id uuid primary key default gen_random_uuid(),
  devis_id uuid not null references public.devis(id) on delete cascade,
  ordre int not null default 1,

  corps_etat text null,
  designation text not null,
  unite text null,

  quantite numeric null,
  prix_unitaire_ht numeric null,
  tva_rate numeric null,

  generer_tache boolean not null default true,
  titre_tache text null,
  date_prevue date null,

  created_at timestamptz not null default now()
);

create index if not exists devis_lignes_devis_id_idx on public.devis_lignes(devis_id);
