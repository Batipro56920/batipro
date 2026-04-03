create table if not exists public.chantier_templates (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  description text null,
  source_chantier_id uuid null references public.chantiers(id) on delete set null,
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists chantier_templates_updated_at_idx
  on public.chantier_templates (updated_at desc);

create index if not exists chantier_templates_source_chantier_idx
  on public.chantier_templates (source_chantier_id, created_at desc);

alter table public.chantier_templates enable row level security;

drop policy if exists chantier_templates_auth_all on public.chantier_templates;
create policy chantier_templates_auth_all
  on public.chantier_templates
  for all
  to authenticated
  using (true)
  with check (true);
