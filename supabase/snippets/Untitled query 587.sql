create table if not exists chantier_access (
  id uuid primary key default gen_random_uuid(),
  chantier_id uuid not null references chantiers(id) on delete cascade,
  intervenant_id uuid references intervenants(id) on delete set null,

  email text not null,
  role text not null default 'INTERVENANT', -- ou 'ADMIN'
  token text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz null,

  created_at timestamptz not null default now()
);

create index if not exists chantier_access_chantier_idx on chantier_access(chantier_id);
create index if not exists chantier_access_email_idx on chantier_access(email);
