create table if not exists public.chantier_budget_settings (
  chantier_id uuid primary key references public.chantiers(id) on delete cascade,
  taux_horaire_mo_ht numeric not null default 48,
  objectif_marge_pct numeric not null default 25,
  commentaire text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.chantier_budget_settings enable row level security;

drop policy if exists chantier_budget_settings_auth_all on public.chantier_budget_settings;
create policy chantier_budget_settings_auth_all
  on public.chantier_budget_settings
  for all
  to authenticated
  using (true)
  with check (true);

do $$
begin
  if to_regclass('public.chantier_purchase_requests') is not null then
    alter table public.chantier_purchase_requests
      add column if not exists cout_prevu_ht numeric not null default 0,
      add column if not exists cout_reel_ht numeric not null default 0;
  end if;
end $$;
