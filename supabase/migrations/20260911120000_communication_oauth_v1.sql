-- Connexion des comptes sociaux : état OAuth et jetons.
--
-- Les jetons ne doivent jamais traverser le navigateur. Les deux tables
-- ci-dessous n'ont aucune politique et aucun droit pour anon ni authenticated :
-- seules les fonctions serveur, qui utilisent la clé de service, les lisent.
-- C'est la même règle que pour les connexions Google Calendar.

create table if not exists public.communication_oauth_states (
  state text primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null check (provider in ('facebook','instagram','linkedin','google_business','tiktok','youtube')),
  redirect_to text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '10 minutes'
);

create table if not exists public.communication_social_tokens (
  social_account_id uuid primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  access_token text not null,
  refresh_token text,
  expires_at timestamptz,
  scopes text[] not null default '{}',
  updated_at timestamptz not null default now(),
  foreign key (social_account_id, organization_id)
    references public.communication_social_accounts(id, organization_id) on delete cascade
);

comment on table public.communication_social_tokens is
  'Jetons OAuth des comptes sociaux. Aucun accès navigateur : service role uniquement.';

create index if not exists communication_oauth_states_expiry_idx
  on public.communication_oauth_states (expires_at);

alter table public.communication_oauth_states enable row level security;
alter table public.communication_social_tokens enable row level security;

revoke all on public.communication_oauth_states from anon, authenticated;
revoke all on public.communication_social_tokens from anon, authenticated;

-- Le compte social porte désormais l'identifiant de la page ou du compte
-- parent : une page Facebook publie avec son propre jeton, pas celui de
-- l'utilisateur, et un compte Instagram professionnel dépend de sa page.
alter table public.communication_social_accounts
  add column if not exists parent_account_id text,
  add column if not exists last_error text;

comment on column public.communication_social_accounts.parent_account_id is
  'Page Facebook dont dépend ce compte, pour Instagram notamment.';
