create table if not exists public.document_client_workflows (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default auth.uid(),
  source_kind text not null check (source_kind in ('quote', 'invoice', 'purchase_order', 'reception_report')),
  source_id uuid not null,
  document_kind text not null check (document_kind in ('quote', 'invoice', 'credit_note', 'purchase_order', 'reception_report')),
  document_number text not null,
  document jsonb not null default '{}'::jsonb,
  recipient_email text not null,
  recipient_name text null,
  subject text not null,
  message text not null default '',
  status text not null default 'sent' check (status in ('sent', 'viewed', 'accepted', 'refused', 'modification_requested', 'expired')),
  require_signature boolean not null default false,
  require_validation boolean not null default true,
  allow_modification_request boolean not null default true,
  auto_reminders boolean not null default false,
  token_hash text not null unique,
  token_expires_at timestamptz not null,
  revoked_at timestamptz null,
  sent_at timestamptz not null default now(),
  viewed_at timestamptz null,
  accepted_at timestamptz null,
  refused_at timestamptz null,
  modification_requested_at timestamptz null,
  signed_at timestamptz null,
  signer_name text null,
  signer_ip inet null,
  signer_user_agent text null,
  client_comment text null,
  last_email_error text null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.document_client_events (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.document_client_workflows(id) on delete cascade,
  event_type text not null check (event_type in ('sent', 'email_sent', 'email_failed', 'viewed', 'accepted', 'refused', 'modification_requested', 'expired', 'revoked')),
  actor_type text not null default 'system' check (actor_type in ('system', 'user', 'client')),
  actor_user_id uuid null references auth.users(id) on delete set null,
  actor_email text null,
  ip inet null,
  user_agent text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists document_client_workflows_org_status_idx
  on public.document_client_workflows (organization_id, status, created_at desc);

create index if not exists document_client_workflows_source_idx
  on public.document_client_workflows (source_kind, source_id, created_at desc);

create index if not exists document_client_workflows_token_hash_idx
  on public.document_client_workflows (token_hash)
  where revoked_at is null;

create index if not exists document_client_events_workflow_idx
  on public.document_client_events (workflow_id, created_at desc);

alter table public.document_client_workflows enable row level security;
alter table public.document_client_events enable row level security;

drop policy if exists document_client_workflows_org_select on public.document_client_workflows;
drop policy if exists document_client_workflows_org_insert on public.document_client_workflows;
drop policy if exists document_client_workflows_org_update on public.document_client_workflows;
drop policy if exists document_client_workflows_org_delete on public.document_client_workflows;

create policy document_client_workflows_org_select
  on public.document_client_workflows for select
  to authenticated
  using (organization_id = auth.uid());

create policy document_client_workflows_org_insert
  on public.document_client_workflows for insert
  to authenticated
  with check (organization_id = auth.uid());

create policy document_client_workflows_org_update
  on public.document_client_workflows for update
  to authenticated
  using (organization_id = auth.uid())
  with check (organization_id = auth.uid());

create policy document_client_workflows_org_delete
  on public.document_client_workflows for delete
  to authenticated
  using (organization_id = auth.uid());

drop policy if exists document_client_events_org_select on public.document_client_events;
drop policy if exists document_client_events_org_insert on public.document_client_events;

create policy document_client_events_org_select
  on public.document_client_events for select
  to authenticated
  using (
    exists (
      select 1
      from public.document_client_workflows w
      where w.id = document_client_events.workflow_id
        and w.organization_id = auth.uid()
    )
  );

create policy document_client_events_org_insert
  on public.document_client_events for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.document_client_workflows w
      where w.id = document_client_events.workflow_id
        and w.organization_id = auth.uid()
    )
  );

grant select, insert, update, delete on table public.document_client_workflows to authenticated;
grant select, insert on table public.document_client_events to authenticated;
