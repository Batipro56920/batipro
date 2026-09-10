-- Espace Communication : campagnes éditoriales collaboratives et médiathèque.
create table public.communication_campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 2 and 160),
  objective text,
  audience text,
  brief text,
  status text not null default 'draft' check (status in ('draft','active','paused','completed','archived')),
  channels text[] not null default '{}',
  start_date date,
  end_date date,
  created_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint communication_campaign_dates check (end_date is null or start_date is null or end_date >= start_date),
  unique (id, organization_id)
);

create table public.communication_campaign_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid not null,
  title text not null check (char_length(trim(title)) between 1 and 180),
  content text,
  item_type text not null default 'idea' check (item_type in ('idea','publication','mockup','task')),
  status text not null default 'idea' check (status in ('idea','to_prepare','to_review','scheduled','published')),
  channels text[] not null default '{}',
  chantier_id uuid references public.chantiers(id) on delete set null,
  scheduled_at timestamptz,
  sort_order integer not null default 0,
  created_by uuid not null default auth.uid() references public.profiles(id),
  created_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, campaign_id, organization_id),
  foreign key (campaign_id, organization_id) references public.communication_campaigns(id, organization_id) on delete cascade
);

create table public.communication_campaign_comments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid not null,
  item_id uuid,
  body text not null check (char_length(trim(body)) between 1 and 4000),
  author_id uuid not null default auth.uid() references public.profiles(id),
  author_name text,
  created_at timestamptz not null default now(),
  foreign key (campaign_id, organization_id) references public.communication_campaigns(id, organization_id) on delete cascade,
  foreign key (item_id, campaign_id, organization_id) references public.communication_campaign_items(id, campaign_id, organization_id) on delete cascade
);

create table public.communication_campaign_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid not null,
  item_id uuid,
  storage_path text not null unique,
  file_name text not null,
  mime_type text,
  file_size bigint check (file_size is null or file_size >= 0),
  created_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  foreign key (campaign_id, organization_id) references public.communication_campaigns(id, organization_id) on delete cascade,
  foreign key (item_id, campaign_id, organization_id) references public.communication_campaign_items(id, campaign_id, organization_id) on delete cascade
);

create index communication_campaigns_org_status_idx on public.communication_campaigns (organization_id, status, updated_at desc);
create index communication_items_campaign_status_idx on public.communication_campaign_items (campaign_id, status, sort_order, created_at);
create index communication_items_calendar_idx on public.communication_campaign_items (organization_id, scheduled_at) where scheduled_at is not null;
create index communication_comments_campaign_idx on public.communication_campaign_comments (campaign_id, created_at);
create index communication_assets_org_idx on public.communication_campaign_assets (organization_id, created_at desc);

create or replace function public.set_communication_updated_at()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger communication_campaigns_updated_at before update on public.communication_campaigns for each row execute function public.set_communication_updated_at();
create trigger communication_items_updated_at before update on public.communication_campaign_items for each row execute function public.set_communication_updated_at();

alter table public.communication_campaigns enable row level security;
alter table public.communication_campaign_items enable row level security;
alter table public.communication_campaign_comments enable row level security;
alter table public.communication_campaign_assets enable row level security;

revoke all on public.communication_campaigns from anon;
revoke all on public.communication_campaign_items from anon;
revoke all on public.communication_campaign_comments from anon;
revoke all on public.communication_campaign_assets from anon;
grant select, insert, update, delete on public.communication_campaigns to authenticated;
grant select, insert, update, delete on public.communication_campaign_items to authenticated;
grant select, insert, update, delete on public.communication_campaign_comments to authenticated;
grant select, insert, delete on public.communication_campaign_assets to authenticated;

create policy communication_campaigns_org on public.communication_campaigns for all to authenticated
using (public.is_backoffice() and organization_id in (select organization_id from public.profiles where id = (select auth.uid())))
with check (public.is_backoffice() and organization_id in (select organization_id from public.profiles where id = (select auth.uid())));
create policy communication_items_org on public.communication_campaign_items for all to authenticated
using (public.is_backoffice() and organization_id in (select organization_id from public.profiles where id = (select auth.uid())))
with check (public.is_backoffice() and organization_id in (select organization_id from public.profiles where id = (select auth.uid())));
create policy communication_comments_org on public.communication_campaign_comments for all to authenticated
using (public.is_backoffice() and organization_id in (select organization_id from public.profiles where id = (select auth.uid())))
with check (public.is_backoffice() and organization_id in (select organization_id from public.profiles where id = (select auth.uid())));
create policy communication_assets_org on public.communication_campaign_assets for all to authenticated
using (public.is_backoffice() and organization_id in (select organization_id from public.profiles where id = (select auth.uid())))
with check (public.is_backoffice() and organization_id in (select organization_id from public.profiles where id = (select auth.uid())));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('communication-assets', 'communication-assets', false, 52428800,
  array['image/jpeg','image/png','image/webp','image/heic','video/mp4','video/quicktime','application/pdf'])
on conflict (id) do nothing;

create policy communication_storage_select on storage.objects for select to authenticated
using (bucket_id = 'communication-assets' and public.is_backoffice() and (storage.foldername(name))[1] in
  (select organization_id::text from public.profiles where id = (select auth.uid())));
create policy communication_storage_insert on storage.objects for insert to authenticated
with check (bucket_id = 'communication-assets' and public.is_backoffice() and (storage.foldername(name))[1] in
  (select organization_id::text from public.profiles where id = (select auth.uid())));
create policy communication_storage_delete on storage.objects for delete to authenticated
using (bucket_id = 'communication-assets' and public.is_backoffice() and (storage.foldername(name))[1] in
  (select organization_id::text from public.profiles where id = (select auth.uid())));

update public.profiles
set allowed_sidebar_groups = array_append(allowed_sidebar_groups, 'Communication')
where role in ('ADMIN','BUREAU') and allowed_sidebar_groups is not null
  and not ('Communication' = any (allowed_sidebar_groups));
