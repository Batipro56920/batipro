-- Tickets de support Batipro : remontées utilisateur, échanges et pièces jointes.
-- Les utilisateurs voient leurs demandes. Les ADMIN voient toutes les demandes
-- de leur organisation, sans accès croisé entre entreprises.

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null default auth.uid() references public.profiles(id),
  reporter_name text,
  reporter_email text,
  category text not null check (category in ('bug', 'problem', 'improvement')),
  status text not null default 'new' check (status in ('new', 'in_progress', 'waiting_user', 'resolved', 'closed')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  title text not null check (char_length(btrim(title)) between 3 and 160),
  description text not null check (char_length(btrim(description)) between 5 and 10000),
  steps_to_reproduce text,
  expected_result text,
  page_url text,
  user_agent text,
  assigned_to uuid references public.profiles(id),
  resolution_summary text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id)
);

create table public.support_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  ticket_id uuid not null,
  author_id uuid not null default auth.uid() references public.profiles(id),
  author_name text,
  body text not null check (char_length(btrim(body)) between 1 and 10000),
  is_internal boolean not null default false,
  created_at timestamptz not null default now(),
  foreign key (ticket_id, organization_id) references public.support_tickets(id, organization_id) on delete cascade,
  unique (id, organization_id, ticket_id)
);

create table public.support_ticket_attachments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  ticket_id uuid not null,
  message_id uuid,
  uploaded_by uuid not null default auth.uid() references public.profiles(id),
  storage_path text not null unique,
  file_name text not null,
  mime_type text,
  file_size bigint check (file_size is null or file_size between 0 and 15728640),
  created_at timestamptz not null default now(),
  foreign key (ticket_id, organization_id) references public.support_tickets(id, organization_id) on delete cascade,
  foreign key (message_id, organization_id, ticket_id) references public.support_ticket_messages(id, organization_id, ticket_id) on delete cascade
);

create index support_tickets_org_status_updated_idx on public.support_tickets (organization_id, status, updated_at desc);
create index support_tickets_creator_updated_idx on public.support_tickets (created_by, updated_at desc);
create index support_ticket_messages_ticket_created_idx on public.support_ticket_messages (ticket_id, created_at);
create index support_ticket_attachments_ticket_idx on public.support_ticket_attachments (ticket_id, created_at);

create or replace function public.touch_support_ticket_from_message()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.support_tickets
  set updated_at = greatest(updated_at, new.created_at)
  where id = new.ticket_id and organization_id = new.organization_id;
  return new;
end;
$$;

revoke all on function public.touch_support_ticket_from_message() from public, anon, authenticated;

create trigger support_ticket_message_touch_ticket
after insert on public.support_ticket_messages
for each row execute function public.touch_support_ticket_from_message();

alter table public.support_tickets enable row level security;
alter table public.support_ticket_messages enable row level security;
alter table public.support_ticket_attachments enable row level security;

revoke all on table public.support_tickets, public.support_ticket_messages, public.support_ticket_attachments from anon, authenticated;
grant select, insert, update, delete on table public.support_tickets to authenticated;
grant select, insert on table public.support_ticket_messages, public.support_ticket_attachments to authenticated;

create policy support_tickets_select on public.support_tickets for select to authenticated
using (
  created_by = (select auth.uid())
  or (
    public.is_admin()
    and organization_id in (select p.organization_id from public.profiles p where p.id = (select auth.uid()))
  )
);

create policy support_tickets_insert on public.support_tickets for insert to authenticated
with check (
  created_by = (select auth.uid())
  and organization_id in (select p.organization_id from public.profiles p where p.id = (select auth.uid()))
);

create policy support_tickets_admin_update on public.support_tickets for update to authenticated
using (
  public.is_admin()
  and organization_id in (select p.organization_id from public.profiles p where p.id = (select auth.uid()))
)
with check (
  public.is_admin()
  and organization_id in (select p.organization_id from public.profiles p where p.id = (select auth.uid()))
);

create policy support_tickets_admin_delete on public.support_tickets for delete to authenticated
using (
  public.is_admin()
  and organization_id in (select p.organization_id from public.profiles p where p.id = (select auth.uid()))
);

create policy support_ticket_messages_select on public.support_ticket_messages for select to authenticated
using (
  exists (
    select 1 from public.support_tickets t
    where t.id = ticket_id
      and t.organization_id = support_ticket_messages.organization_id
      and (
        t.created_by = (select auth.uid())
        or (public.is_admin() and t.organization_id in (select p.organization_id from public.profiles p where p.id = (select auth.uid())))
      )
  )
  and (not is_internal or public.is_admin())
);

create policy support_ticket_messages_insert on public.support_ticket_messages for insert to authenticated
with check (
  author_id = (select auth.uid())
  and exists (
    select 1 from public.support_tickets t
    where t.id = ticket_id
      and t.organization_id = support_ticket_messages.organization_id
      and (
        t.created_by = (select auth.uid())
        or (public.is_admin() and t.organization_id in (select p.organization_id from public.profiles p where p.id = (select auth.uid())))
      )
  )
  and (not is_internal or public.is_admin())
);

create policy support_ticket_attachments_select on public.support_ticket_attachments for select to authenticated
using (
  exists (
    select 1 from public.support_tickets t
    where t.id = ticket_id
      and t.organization_id = support_ticket_attachments.organization_id
      and (
        t.created_by = (select auth.uid())
        or (public.is_admin() and t.organization_id in (select p.organization_id from public.profiles p where p.id = (select auth.uid())))
      )
  )
);

create policy support_ticket_attachments_insert on public.support_ticket_attachments for insert to authenticated
with check (
  uploaded_by = (select auth.uid())
  and exists (
    select 1 from public.support_tickets t
    where t.id = ticket_id
      and t.organization_id = support_ticket_attachments.organization_id
      and (
        t.created_by = (select auth.uid())
        or (public.is_admin() and t.organization_id in (select p.organization_id from public.profiles p where p.id = (select auth.uid())))
      )
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'support-tickets',
  'support-tickets',
  false,
  15728640,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf', 'video/mp4']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy support_ticket_files_select on storage.objects for select to authenticated
using (
  bucket_id = 'support-tickets'
  and exists (
    select 1 from public.support_tickets t
    where t.id::text = (storage.foldername(name))[2]
      and t.organization_id::text = (storage.foldername(name))[1]
      and (
        t.created_by = (select auth.uid())
        or (public.is_admin() and t.organization_id in (select p.organization_id from public.profiles p where p.id = (select auth.uid())))
      )
  )
);

create policy support_ticket_files_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'support-tickets'
  and exists (
    select 1 from public.support_tickets t
    where t.id::text = (storage.foldername(name))[2]
      and t.organization_id::text = (storage.foldername(name))[1]
      and (
        t.created_by = (select auth.uid())
        or (public.is_admin() and t.organization_id in (select p.organization_id from public.profiles p where p.id = (select auth.uid())))
      )
  )
);

create policy support_ticket_files_admin_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'support-tickets'
  and public.is_admin()
  and exists (
    select 1 from public.support_tickets t
    where t.id::text = (storage.foldername(name))[2]
      and t.organization_id::text = (storage.foldername(name))[1]
      and t.organization_id in (select p.organization_id from public.profiles p where p.id = (select auth.uid()))
  )
);

comment on table public.support_tickets is 'Demandes de support Batipro visibles par leur auteur et les administrateurs de la même organisation.';
