alter table public.portal_resource_preparations add column if not exists office_assignment_id uuid references public.office_planning_assignments(id);
create unique index if not exists portal_resource_office_unique on public.portal_resource_preparations(office_assignment_id,resource_type,resource_id) where office_assignment_id is not null;
create or replace function public.office_assign_equipment(p_chantier uuid,p_worker uuid,p_start date,p_end date,p_equipment text[])
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_org uuid;v_id uuid;v_item jsonb;v_resource text;v_config jsonb;
begin
 if not public.office_planning_access() then raise exception 'office_only'; end if;
 v_org:=public.current_organization_id();
 if v_org is null or public.chantier_organization_id(p_chantier) is distinct from v_org then raise exception 'invalid_chantier'; end if;
 if not exists(select 1 from public.intervenants where id=p_worker and is_active=true) then raise exception 'invalid_worker'; end if;
 if p_start is null or p_end is null or p_end<p_start or p_end>p_start+90 then raise exception 'invalid_period'; end if;
 if coalesce(array_length(p_equipment,1),0)>30 then raise exception 'too_many_resources'; end if;
 select indirect_costs into v_config from public.company_settings where organization_id=v_org limit 1;
 insert into public.office_planning_assignments(organization_id,chantier_id,intervenant_id,date_start,date_end)
 values(v_org,p_chantier,p_worker,p_start,p_end) returning id into v_id;
 foreach v_resource in array coalesce(p_equipment,'{}'::text[]) loop
  select x into v_item from jsonb_array_elements(coalesce(v_config->'equipmentAssets','[]'::jsonb)) x where x->>'id'=v_resource limit 1;
  if v_item is null then raise exception 'invalid_equipment'; end if;
  insert into public.portal_resource_preparations(organization_id,chantier_id,intervenant_id,resource_type,resource_id,resource_name,unit,quantity,planned_for,office_assignment_id)
  values(v_org,p_chantier,p_worker,'equipment',v_resource,coalesce(v_item->>'name','Matériel'),'unité',1,p_start,v_id);
 end loop;
 return v_id;
end $$;
revoke all on function public.office_assign_equipment(uuid,uuid,date,date,text[]) from public;
grant execute on function public.office_assign_equipment(uuid,uuid,date,date,text[]) to authenticated;