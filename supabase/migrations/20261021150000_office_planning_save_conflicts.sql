-- One reservation per equipment and assignment: occupied for the whole interval, issued only once.
create or replace function public.office_planning_save(
 p_id uuid,p_chantier uuid,p_worker uuid,p_start date,p_end date,p_equipment text[])
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_org uuid;v_id uuid;v_config jsonb;v_item jsonb;v_resource text;v_old record;
begin
 if not public.office_planning_access() then raise exception 'office_only'; end if;
 v_org:=public.current_organization_id();
 if v_org is null or public.chantier_organization_id(p_chantier) is distinct from v_org then raise exception 'invalid_chantier'; end if;
 if not exists(select 1 from public.intervenants where id=p_worker and is_active=true) then raise exception 'invalid_worker'; end if;
 if p_start is null or p_end is null or p_end<p_start or p_end>p_start+90 then raise exception 'invalid_period'; end if;
 if coalesce(array_length(p_equipment,1),0)>30 then raise exception 'too_many_resources'; end if;
 perform pg_advisory_xact_lock(hashtext(v_org::text));
 if exists(select 1 from public.office_planning_assignments a where a.organization_id=v_org and a.intervenant_id=p_worker
 and a.id is distinct from p_id and a.date_start<=p_end and a.date_end>=p_start) then raise exception 'worker_already_booked'; end if;
 if exists(select 1 from public.portal_resource_preparations pr
 join public.office_planning_assignments a on a.id=pr.office_assignment_id
 where a.organization_id=v_org and a.id is distinct from p_id and pr.resource_type='equipment' and pr.status<>'cancelled'
 and pr.resource_id=any(p_equipment) and a.date_start<=p_end and a.date_end>=p_start)
 then raise exception 'equipment_already_booked'; end if;
 select indirect_costs into v_config from public.company_settings where organization_id=v_org limit 1;
 if p_id is null then
  insert into public.office_planning_assignments(organization_id,chantier_id,intervenant_id,date_start,date_end)
  values(v_org,p_chantier,p_worker,p_start,p_end) returning id into v_id;
 else
  select * into v_old from public.office_planning_assignments where id=p_id and organization_id=v_org for update;
  if not found then raise exception 'assignment_missing'; end if;
  if exists(select 1 from public.portal_resource_preparations where office_assignment_id=p_id and status='issued')
  then raise exception 'already_issued'; end if;
  update public.office_planning_assignments set chantier_id=p_chantier,intervenant_id=p_worker,date_start=p_start,date_end=p_end where id=p_id;
  delete from public.portal_resource_preparations where office_assignment_id=p_id and status='reserved';
  v_id:=p_id;
 end if;
 foreach v_resource in array coalesce(p_equipment,'{}'::text[]) loop
  select x into v_item from jsonb_array_elements(coalesce(v_config->'equipmentAssets','[]'::jsonb)) x where x->>'id'=v_resource limit 1;
  if v_item is null then raise exception 'invalid_equipment'; end if;
  insert into public.portal_resource_preparations(organization_id,chantier_id,intervenant_id,resource_type,resource_id,resource_name,unit,quantity,planned_for,office_assignment_id)
  values(v_org,p_chantier,p_worker,'equipment',v_resource,coalesce(v_item->>'name','Matériel'),'unité',1,p_start,v_id);
 end loop;
 insert into public.chantier_intervenants(chantier_id,intervenant_id) values(p_chantier,p_worker) on conflict do nothing;
 return v_id;
end $$;
revoke all on function public.office_planning_save(uuid,uuid,uuid,date,date,text[]) from public;
grant execute on function public.office_planning_save(uuid,uuid,uuid,date,date,text[]) to authenticated;
