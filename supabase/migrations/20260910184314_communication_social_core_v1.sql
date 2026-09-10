-- Socle d'une suite social media : connexions, variantes, validations,
-- publication asynchrone, boite de reception et mesures.
create table public.communication_social_accounts (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null check (provider in ('facebook','instagram','linkedin','google_business','tiktok','youtube')),
  external_account_id text not null, display_name text not null, avatar_url text, status text not null default 'connected' check (status in ('connected','expired','revoked')),
  scopes text[] not null default '{}', connected_by uuid default auth.uid() references public.profiles(id),
  connected_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(organization_id,provider,external_account_id), unique(id,organization_id)
);
-- Les jetons OAuth ne sont jamais stockes dans une table exposee au navigateur.
-- Ils seront conserves cote serveur (Vault / schema prive) et manipules uniquement
-- par les Edge Functions de connexion et de publication.
alter table public.communication_campaign_items add constraint communication_items_id_org_unique unique(id,organization_id);
create table public.communication_publication_variants (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  item_id uuid not null, social_account_id uuid, network text not null, body text, link_url text, first_comment text, metadata jsonb not null default '{}',
  approval_status text not null default 'draft' check (approval_status in ('draft','review_requested','changes_requested','approved')),
  approved_by uuid references public.profiles(id), approved_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(id,organization_id),
  foreign key(item_id,organization_id) references public.communication_campaign_items(id,organization_id) on delete cascade,
  foreign key(social_account_id,organization_id) references public.communication_social_accounts(id,organization_id)
);
create table public.communication_approval_events (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  variant_id uuid not null,
  action text not null check(action in ('requested','approved','changes_requested','cancelled')), note text,
  actor_id uuid not null default auth.uid() references public.profiles(id), actor_name text, created_at timestamptz not null default now(),
  foreign key(variant_id,organization_id) references public.communication_publication_variants(id,organization_id) on delete cascade
);
create table public.communication_publish_jobs (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  variant_id uuid not null,
  scheduled_at timestamptz not null, status text not null default 'queued' check(status in ('queued','processing','published','failed','cancelled')),
  attempts integer not null default 0, provider_post_id text, provider_url text, last_error text, published_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key(variant_id,organization_id) references public.communication_publication_variants(id,organization_id) on delete cascade
);
create table public.communication_inbox_threads (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  social_account_id uuid not null, provider_thread_id text not null, kind text not null check(kind in ('message','comment','mention','review')),
  contact_name text, contact_avatar_url text, subject text, status text not null default 'open' check(status in ('open','pending','closed')),
  assigned_to uuid references public.profiles(id), last_message_at timestamptz not null default now(), metadata jsonb not null default '{}',
  foreign key(social_account_id,organization_id) references public.communication_social_accounts(id,organization_id) on delete cascade,
  unique(organization_id,social_account_id,provider_thread_id), unique(id,organization_id)
);
create table public.communication_inbox_messages (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  thread_id uuid not null, provider_message_id text,
  direction text not null check(direction in ('inbound','outbound','internal_note')), body text, media jsonb not null default '[]', author_name text,
  sent_at timestamptz not null default now(), unique(thread_id,provider_message_id),
  foreign key(thread_id,organization_id) references public.communication_inbox_threads(id,organization_id) on delete cascade
);
create table public.communication_post_metrics (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  variant_id uuid not null, measured_at timestamptz not null default now(),
  impressions bigint not null default 0, reach bigint not null default 0, engagements bigint not null default 0, clicks bigint not null default 0,
  comments bigint not null default 0, shares bigint not null default 0, leads bigint not null default 0,
  foreign key(variant_id,organization_id) references public.communication_publication_variants(id,organization_id) on delete cascade
);
create index communication_publish_jobs_due_idx on public.communication_publish_jobs(status,scheduled_at) where status='queued';
create index communication_inbox_org_recent_idx on public.communication_inbox_threads(organization_id,status,last_message_at desc);
create index communication_metrics_variant_time_idx on public.communication_post_metrics(variant_id,measured_at desc);

do $$ declare table_name text; begin
  foreach table_name in array array['communication_social_accounts','communication_publication_variants','communication_approval_events','communication_publish_jobs','communication_inbox_threads','communication_inbox_messages','communication_post_metrics'] loop
    execute format('alter table public.%I enable row level security',table_name);
    execute format('revoke all on public.%I from anon',table_name);
    execute format('grant select,insert,update,delete on public.%I to authenticated',table_name);
    execute format('create policy %I on public.%I for all to authenticated using (public.is_backoffice() and organization_id in (select organization_id from public.profiles where id=(select auth.uid()))) with check (public.is_backoffice() and organization_id in (select organization_id from public.profiles where id=(select auth.uid())))',table_name||'_org',table_name);
  end loop;
end $$;
