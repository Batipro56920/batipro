create or replace function public.resource_stock_summary()
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
with org as (select public.current_organization_id() id),
resources as (
select x->>'id' id,'consumable' kind,0::numeric starting
from public.company_settings s cross join lateral jsonb_array_elements(coalesce(s.indirect_costs->'consumables','[]'::jsonb)) x where s.organization_id=(select id from org)
union all
select x->>'id','equipment',coalesce((x->>'quantity')::numeric,1)
from public.company_settings s cross join lateral jsonb_array_elements(coalesce(s.indirect_costs->'equipmentAssets','[]'::jsonb)) x where s.organization_id=(select id from org)),
a as (select resource_id,sum(quantity) qty from public.consumable_stock_receipts where organization_id=(select id from org) group by resource_id),
b as (select resource_type,resource_id,sum(quantity) qty from public.portal_resource_movements where organization_id=(select id from org) group by resource_type,resource_id),
c as (select resource_type,resource_id,sum(returned_quantity) qty,sum(used_quantity) used from public.portal_resource_actual_usage where organization_id=(select id from org) group by resource_type,resource_id)
select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'kind',r.kind,'available',r.starting+coalesce(a.qty,0)-coalesce(b.qty,0)+coalesce(c.qty,0),'issued',coalesce(b.qty,0),'returned',coalesce(c.qty,0),'used',coalesce(c.used,0))), '[]'::jsonb)
from resources r left join a on r.kind='consumable' and a.resource_id=r.id left join b on b.resource_type=r.kind and b.resource_id=r.id left join c on c.resource_type=r.kind and c.resource_id=r.id;
$$;
revoke all on function public.resource_stock_summary() from public;
grant execute on function public.resource_stock_summary() to authenticated;
