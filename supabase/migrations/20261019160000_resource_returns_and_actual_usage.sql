-- Clôture réelle d'une sortie. Les ressources ne sont pas utilisées du seul fait de leur départ.
alter table public.portal_resource_preparations
  add column if not exists completed_at timestamptz,
  add column if not exists used_quantity numeric,
  add column if not exists returned_quantity numeric;
alter table public.portal_resource_preparations
  drop constraint if exists portal_resource_preparations_usage_check;
alter table public.portal_resource_preparations add constraint portal_resource_preparations_usage_check
  check (used_quantity is null or (used_quantity >= 0 and returned_quantity >= 0 and returned_quantity <= quantity and (resource_type = 'equipment' or used_quantity + returned_quantity <= quantity)));
create table if not exists public.portal_resource_actual_usage (
  id uuid primary key default gen_random_uuid(),
  preparation_id uuid not null unique references public.portal_resource_preparations(id),
  organization_id uuid not null,
  chantier_id uuid not null,
  intervenant_id uuid not null,
  resource_type text not null check (resource_type in ('equipment','consumable')),
  resource_id text not null,
  used_quantity numeric not null check (used_quantity >= 0),
  returned_quantity numeric not null check (returned_quantity >= 0),
  completed_at timestamptz not null default now()
);
create index if not exists portal_resource_actual_usage_summary on public.portal_resource_actual_usage(organization_id,resource_type,resource_id,completed_at);
alter table public.portal_resource_actual_usage enable row level security;
revoke all on public.portal_resource_actual_usage from anon,authenticated;
create or replace function public.intervenant_resource_complete(
 p_token text, p_chantier_id uuid, p_preparation_id uuid,
 p_used_quantity numeric, p_returned_quantity numeric
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_worker uuid; v_row public.portal_resource_preparations%rowtype;
begin
 v_worker:=public._intervenant_assert_chantier_access(p_token,p_chantier_id);
 if v_worker is null then raise exception 'forbidden'; end if;
 select * into v_row from public.portal_resource_preparations where id=p_preparation_id
   and chantier_id=p_chantier_id and intervenant_id=v_worker for update;
 if not found then raise exception 'preparation_not_found'; end if;
 if v_row.completed_at is not null then return jsonb_build_object('id',v_row.id,'already_completed',true); end if;
 if v_row.status <> 'issued' then raise exception 'resource_not_issued'; end if;
 if p_used_quantity is null or p_used_quantity < 0 or p_returned_quantity is null or p_returned_quantity < 0 then raise exception 'invalid_quantities'; end if;
 if v_row.resource_type='consumable' and p_used_quantity+p_returned_quantity>v_row.quantity then raise exception 'quantity_exceeds_issue'; end if;
 if v_row.resource_type='equipment' and p_returned_quantity>v_row.quantity then raise exception 'quantity_exceeds_issue'; end if;
 insert into public.portal_resource_actual_usage(preparation_id,organization_id,chantier_id,intervenant_id,resource_type,resource_id,used_quantity,returned_quantity)
 values (v_row.id,v_row.organization_id,v_row.chantier_id,v_row.intervenant_id,v_row.resource_type,v_row.resource_id,p_used_quantity,p_returned_quantity);
 update public.portal_resource_preparations set completed_at=now(), used_quantity=p_used_quantity,returned_quantity=p_returned_quantity where id=v_row.id;
 return jsonb_build_object('id',v_row.id,'already_completed',false);
end $$;
create or replace function public.intervenant_resource_annual_usage(p_token text,p_chantier_id uuid,p_year integer)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_worker uuid;
begin
 v_worker:=public._intervenant_assert_chantier_access(p_token,p_chantier_id);
 if v_worker is null then raise exception 'forbidden'; end if;
 if p_year < 2000 or p_year > 2100 then raise exception 'invalid_year'; end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('resource_id',resource_id,'resource_type',resource_type,'used',used,'returned',returned)),'[]'::jsonb)
 from (select resource_id,resource_type,sum(used_quantity) used,sum(returned_quantity) returned
 from public.portal_resource_actual_usage where organization_id=public.chantier_organization_id(p_chantier_id)
 and completed_at >= make_date(p_year,1,1) and completed_at < make_date(p_year+1,1,1)
 group by resource_id,resource_type) totals);
end $$;
revoke all on function public.intervenant_resource_complete(text,uuid,uuid,numeric,numeric) from public;
revoke all on function public.intervenant_resource_annual_usage(text,uuid,integer) from public;
grant execute on function public.intervenant_resource_complete(text,uuid,uuid,numeric,numeric) to anon,authenticated;
grant execute on function public.intervenant_resource_annual_usage(text,uuid,integer) to anon,authenticated;
