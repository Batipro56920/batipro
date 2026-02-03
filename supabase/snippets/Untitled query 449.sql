create table if not exists public.chantier_access (
  id uuid primary key default gen_random_uuid(),
  chantier_id uuid not null references public.chantiers(id) on delete cascade,
  email text not null,
  token text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_chantier_access_chantier on public.chantier_access(chantier_id);
create index if not exists idx_chantier_access_token on public.chantier_access(token);
