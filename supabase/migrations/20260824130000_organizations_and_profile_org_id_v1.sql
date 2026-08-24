-- Lot 1 (Phase A) — real organizations table for the mono-entreprise CB Renovation.
-- Complementary migration; does not modify any already-applied migration.
--
-- Scope: ONLY public.organizations and profiles.organization_id. Does NOT touch
-- any other table's organization_id column/default/RLS — those still use the
-- legacy `organization_id = auth.uid()` (creator id) pattern and are addressed
-- together with their RLS policy replacement (see Lot 2 report), because
-- changing their data/default in isolation would break existing RLS checks
-- (`organization_id = auth.uid()`) for the admin account before the policies
-- are updated to check organization membership instead.

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

alter table public.organizations enable row level security;

drop policy if exists organizations_authenticated_select on public.organizations;
create policy organizations_authenticated_select
  on public.organizations
  for select
  to authenticated
  using (true);

insert into public.organizations (name)
select 'CB Renovation'
where not exists (select 1 from public.organizations);

alter table public.profiles
  add column if not exists organization_id uuid references public.organizations(id);

do $$
declare
  v_org_id uuid;
begin
  select id into v_org_id from public.organizations order by created_at limit 1;

  update public.profiles
  set organization_id = v_org_id
  where organization_id is null;

  execute format('alter table public.profiles alter column organization_id set default %L', v_org_id);
  execute 'alter table public.profiles alter column organization_id set not null';
end $$;
