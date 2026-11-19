create role authenticated;
create role anon;
create schema storage;
create table storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);
create table storage.objects (
  id bigint generated always as identity primary key,
  bucket_id text not null references storage.buckets(id),
  name text not null
);
alter table storage.objects enable row level security;
grant usage on schema storage, public to authenticated, anon;
grant select, insert, delete on storage.objects to authenticated;
grant select on storage.objects to anon;
grant usage, select on sequence storage.objects_id_seq to authenticated;
create function storage.foldername(path text) returns text[]
language sql immutable as $$
 select string_to_array(path, '/')
$$;
create function public.is_backoffice() returns boolean
language sql stable as $$
 select coalesce(current_setting('app.office', true) = 'true', false)
$$;
create function public.current_organization_id() returns uuid
language sql stable as $$
 select nullif(current_setting('app.org', true),'')::uuid
$$;
