-- 1) (optionnel) extension utile si pas déjà activée
-- create extension if not exists pgcrypto;

-- 2) table materiel_demandes
create table if not exists public.materiel_demandes (
  id uuid primary key default gen_random_uuid(),

  chantier_id uuid not null references public.chantiers(id) on delete cascade,
  intervenant_id uuid not null references public.intervenants(id) on delete restrict,

  designation text not null,
  quantite numeric not null default 1,

  date_livraison date null,
  remarques text null,

  -- statut matériel : à commander / commandé / livré
  status text not null default 'A_COMMANDER'
    check (status in ('A_COMMANDER', 'COMMANDE', 'LIVRE')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3) index (pratique)
create index if not exists materiel_demandes_chantier_idx
  on public.materiel_demandes(chantier_id);

create index if not exists materiel_demandes_intervenant_idx
  on public.materiel_demandes(intervenant_id);

-- 4) trigger updated_at (si tu as déjà une fonction standard, adapte)
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_materiel_demandes_updated_at on public.materiel_demandes;

create trigger trg_materiel_demandes_updated_at
before update on public.materiel_demandes
for each row execute function public.set_updated_at();

alter table public.materiel_demandes
add column if not exists unite text null;
