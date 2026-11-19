-- Minimal isolated PostgreSQL fixture for Batipro's planning migrations.
-- This is NOT a copy of production data or production permissions.
create role anon;
create role authenticated;

create table public.chantiers (
  id uuid primary key,
  organization_id uuid not null
);
create table public.intervenants (
  id uuid primary key,
  is_active boolean not null default true
);
create table public.office_planning_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  chantier_id uuid not null references public.chantiers(id),
  intervenant_id uuid not null references public.intervenants(id),
  date_start date not null,
  date_end date not null,
  note text not null default '',
  check (date_end >= date_start)
);
create table public.chantier_task_segments (
  id uuid primary key default gen_random_uuid(),
  chantier_id uuid not null references public.chantiers(id),
  intervenant_id uuid references public.intervenants(id),
  start_date date,
  duration_days numeric,
  start_at timestamptz,
  end_at timestamptz,
  status text
);
create table public.chantier_task_planning_segments
  (like public.chantier_task_segments including all);
create table public.portal_resource_preparations (
  id uuid primary key default gen_random_uuid(),
  office_assignment_id uuid references public.office_planning_assignments(id),
  organization_id uuid,
  chantier_id uuid,
  intervenant_id uuid,
  resource_type text,
  resource_id text,
  resource_name text,
  unit text,
  quantity numeric,
  planned_for date,
  status text not null default 'reserved'
);
create table public.company_settings (
  organization_id uuid primary key,
  indirect_costs jsonb not null default '{}'::jsonb
);
create table public.chantier_intervenants (
  chantier_id uuid not null references public.chantiers(id),
  intervenant_id uuid not null references public.intervenants(id),
  primary key (chantier_id, intervenant_id)
);

create function public.office_planning_access()
returns boolean language sql stable as $$ select true $$;
create function public.current_organization_id()
returns uuid language sql stable as
$$ select '00000000-0000-0000-0000-000000000001'::uuid $$;
create function public.chantier_organization_id(p_chantier uuid)
returns uuid language sql stable as
$$ select organization_id from public.chantiers where id = p_chantier $$;

insert into public.chantiers(id,organization_id) values
('00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000001'),
('00000000-0000-0000-0000-000000000012','00000000-0000-0000-0000-000000000001');
insert into public.intervenants(id) values
('00000000-0000-0000-0000-000000000021'),
('00000000-0000-0000-0000-000000000022');
insert into public.company_settings(organization_id)
values ('00000000-0000-0000-0000-000000000001');
