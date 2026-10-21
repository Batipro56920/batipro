create table if not exists public.office_planning_assignments (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null,
 chantier_id uuid not null references public.chantiers(id) on delete cascade,
 intervenant_id uuid not null references public.intervenants(id),
 date_start date not null,
 date_end date not null,
 note text not null default '',
 created_at timestamptz not null default now(),
 constraint office_planning_dates check(date_end >= date_start)
);
create index if not exists office_planning_assignments_dates on public.office_planning_assignments(organization_id,date_start,date_end);
create index if not exists office_planning_assignments_worker on public.office_planning_assignments(intervenant_id,date_start,date_end);
alter table public.office_planning_assignments enable row level security;
revoke all on public.office_planning_assignments from anon,authenticated;
create or replace function public.office_planning_access()
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.profiles p where p.id=auth.uid()
 and upper(coalesce(p.role,'')) not in ('INTERVENANT','OUVRIER','SOUS_TRAITANT','SUBCONTRACTOR') and coalesce(p.role,'')<>'')
$$;
revoke all on function public.office_planning_access() from public;
grant execute on function public.office_planning_access() to authenticated;
create policy office_planning_read on public.office_planning_assignments for select to authenticated
 using(organization_id=public.current_organization_id() and public.office_planning_access());
create policy office_planning_insert on public.office_planning_assignments for insert to authenticated
 with check(organization_id=public.current_organization_id() and public.office_planning_access()
 and organization_id=public.chantier_organization_id(chantier_id));
create policy office_planning_delete on public.office_planning_assignments for delete to authenticated
 using(organization_id=public.current_organization_id() and public.office_planning_access());
grant select,insert,delete on public.office_planning_assignments to authenticated;
create or replace function public.intervenant_office_planning(p_token text,p_chantier_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare worker uuid;
begin
 worker:=public._intervenant_assert_chantier_access(p_token,p_chantier_id);
 if worker is null then raise exception 'intervenant_required'; end if;
 return (
 select coalesce(jsonb_agg(jsonb_build_object(
 'id',a.id,'date_start',a.date_start,'date_end',a.date_end,'note',a.note,'chantier_id',a.chantier_id)
 order by a.date_start),'[]'::jsonb)
 from public.office_planning_assignments a
 where a.intervenant_id=worker and a.chantier_id=p_chantier_id
 );
end $$;
revoke all on function public.intervenant_office_planning(text,uuid) from public;
grant execute on function public.intervenant_office_planning(text,uuid) to anon,authenticated;
