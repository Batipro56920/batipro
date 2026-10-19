-- Préparation du dépôt : une réservation n'est jamais une sortie.
create table if not exists public.portal_resource_preparations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  chantier_id uuid not null references public.chantiers(id) on delete cascade,
  intervenant_id uuid not null,
  resource_type text not null check (resource_type in ('equipment','consumable')),
  resource_id text not null,
  resource_name text not null,
  unit text not null,
  quantity numeric not null check (quantity > 0),
  planned_for date not null,
  status text not null default 'reserved' check (status in ('reserved','issued','cancelled')),
  created_at timestamptz not null default now(),
  issued_at timestamptz,
  unique(id, chantier_id)
);
create index if not exists portal_resource_preparations_lookup on public.portal_resource_preparations(intervenant_id, planned_for, status);
alter table public.portal_resource_preparations enable row level security;
revoke all on public.portal_resource_preparations from anon, authenticated;
-- SECURITY DEFINER RPC validates access to the exact chantier and catalog in every call.
create or replace function public.intervenant_resource_catalog(p_token text, p_chantier_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_worker uuid; v_org uuid; v_config jsonb; v_list jsonb;
begin
  v_worker := public._intervenant_assert_chantier_access(p_token, p_chantier_id);
  if v_worker is null then raise exception 'forbidden'; end if;
  v_org := public.chantier_organization_id(p_chantier_id);
  select coalesce(indirect_costs, '{}'::jsonb) into v_config from public.company_settings where organization_id=v_org limit 1;
  select coalesce(jsonb_agg(jsonb_build_object('id', item->>'id','name',item->>'name','kind','equipment','unit','u')),'[]'::jsonb)
    into v_list from jsonb_array_elements(coalesce(v_config->'equipmentAssets','[]'::jsonb)) item
    where coalesce((item->>'active')::boolean,true) and nullif(item->>'id','') is not null;
  return v_list || (select coalesce(jsonb_agg(jsonb_build_object('id',item->>'id','name',item->>'name','kind','consumable',
    'unit',case item->>'mode' when 'use' then 'utilisation' when 'hour' then 'h' when 'day' then 'jour' else coalesce(item->>'unit','u') end)),'[]'::jsonb)
    from jsonb_array_elements(coalesce(v_config->'consumables','[]'::jsonb)) item
    where coalesce((item->>'active')::boolean,true) and nullif(item->>'id','') is not null);
end $$;
create or replace function public.intervenant_resource_preparations(p_token text,p_chantier_id uuid,p_date date)
returns jsonb language plpgsql security definer set search_path = public,pg_temp as $$
declare v_worker uuid;
begin
 v_worker:=public._intervenant_assert_chantier_access(p_token,p_chantier_id);
 if v_worker is null then raise exception 'forbidden'; end if;
 return (select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at),'[]'::jsonb) from public.portal_resource_preparations t
 where t.chantier_id=p_chantier_id and t.intervenant_id=v_worker and t.planned_for=p_date and t.status<>'cancelled');
end $$;
create or replace function public.intervenant_resource_prepare(p_token text,p_chantier_id uuid,p_date date,
 p_kind text,p_resource_id text,p_quantity numeric)
returns jsonb language plpgsql security definer set search_path = public,pg_temp as $$
declare v_worker uuid;v_org uuid;v_catalog jsonb;v_resource jsonb;v_id uuid;v_name text;v_unit text;
begin
 v_worker:=public._intervenant_assert_chantier_access(p_token,p_chantier_id);
 if v_worker is null then raise exception 'forbidden'; end if;
 if p_date is null or p_date < current_date or p_quantity is null or p_quantity <= 0 or p_quantity > 100000 then raise exception 'invalid_preparation'; end if;
 if p_kind not in ('equipment','consumable') then raise exception 'invalid_resource_kind'; end if;
 v_catalog:=public.intervenant_resource_catalog(p_token,p_chantier_id);
 select item into v_resource from jsonb_array_elements(v_catalog) item where item->>'id'=p_resource_id and item->>'kind'=p_kind limit 1;
 if v_resource is null then raise exception 'resource_not_found'; end if;
 v_org:=public.chantier_organization_id(p_chantier_id);
 insert into public.portal_resource_preparations(organization_id,chantier_id,intervenant_id,resource_type,resource_id,resource_name,unit,quantity,planned_for)
 values(v_org,p_chantier_id,v_worker,p_kind,p_resource_id,v_resource->>'name',v_resource->>'unit',p_quantity,p_date) returning id into v_id;
 return jsonb_build_object('id',v_id,'status','reserved');
end $$;
create or replace function public.intervenant_resource_issue(p_token text,p_chantier_id uuid,p_preparation_id uuid)
returns jsonb language plpgsql security definer set search_path = public,pg_temp as $$
declare v_worker uuid;v_row public.portal_resource_preparations%rowtype;
begin
 v_worker:=public._intervenant_assert_chantier_access(p_token,p_chantier_id);
 if v_worker is null then raise exception 'forbidden'; end if;
 select * into v_row from public.portal_resource_preparations
 where id=p_preparation_id and chantier_id=p_chantier_id and intervenant_id=v_worker for update;
 if not found then raise exception 'preparation_not_found'; end if;
 if v_row.status='issued' then return jsonb_build_object('id',v_row.id,'status','issued','already_issued',true); end if;
 if v_row.status<>'reserved' then raise exception 'preparation_not_reserved'; end if;
 update public.portal_resource_preparations set status='issued', issued_at=now() where id=v_row.id;
 -- Unique state transition. Stock quantity and physical custody are derived from issued rows.
 return jsonb_build_object('id',v_row.id,'status','issued','already_issued',false);
end $$;
revoke all on function public.intervenant_resource_catalog(text,uuid) from public;
revoke all on function public.intervenant_resource_preparations(text,uuid,date) from public;
revoke all on function public.intervenant_resource_prepare(text,uuid,date,text,text,numeric) from public;
revoke all on function public.intervenant_resource_issue(text,uuid,uuid) from public;
grant execute on function public.intervenant_resource_catalog(text,uuid) to anon,authenticated;
grant execute on function public.intervenant_resource_preparations(text,uuid,date) to anon,authenticated;
grant execute on function public.intervenant_resource_prepare(text,uuid,date,text,text,numeric) to anon,authenticated;
grant execute on function public.intervenant_resource_issue(text,uuid,uuid) to anon,authenticated;
