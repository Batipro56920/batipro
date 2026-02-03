-- Table: chantier_access
create table if not exists public.chantier_access (
  id uuid primary key default gen_random_uuid(),

  chantier_id uuid not null
    references public.chantiers(id)
    on delete cascade,

  intervenant_id uuid null,

  email text not null,
  role text not null default 'INTERVENANT', -- INTERVENANT | ADMIN
  token text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz null,

  created_at timestamptz not null default now()
);

create index if not exists chantier_access_chantier_idx
  on public.chantier_access(chantier_id);

create index if not exists chantier_access_email_idx
  on public.chantier_access(email);

create index if not exists chantier_access_token_idx
  on public.chantier_access(token);

alter table public.chantier_access enable row level security;
