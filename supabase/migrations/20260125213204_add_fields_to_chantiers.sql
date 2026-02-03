alter table public.chantiers
  add column if not exists adresse text,
  add column if not exists status text not null default 'PREPARATION',
  add column if not exists avancement int not null default 0,
  add column if not exists date_debut date,
  add column if not exists heures_prevues numeric,
  add column if not exists heures_passees numeric;
