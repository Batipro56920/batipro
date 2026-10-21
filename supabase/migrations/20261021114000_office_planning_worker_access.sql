-- An affectation du bureau autorise l'ouvrier à voir ce chantier dans son portail.
create or replace function public.office_planning_grant_chantier()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.organization_id <> public.chantier_organization_id(new.chantier_id) then
  raise exception 'organization_mismatch';
 end if;
 insert into public.chantier_intervenants(chantier_id,intervenant_id)
 values(new.chantier_id,new.intervenant_id)
 on conflict(chantier_id,intervenant_id) do nothing;
 return new;
end $$;
drop trigger if exists office_planning_worker_access on public.office_planning_assignments;
create trigger office_planning_worker_access after insert on public.office_planning_assignments
for each row execute function public.office_planning_grant_chantier();
insert into public.chantier_intervenants(chantier_id,intervenant_id)
select distinct chantier_id,intervenant_id from public.office_planning_assignments
on conflict(chantier_id,intervenant_id) do nothing;
