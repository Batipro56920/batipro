create or replace view public.consumable_stock_balance with (security_invoker=true) as select organization_id, resource_id, sum(quantity) as received from public.consumable_stock_receipts group by organization_id, resource_id;
grant select on public.consumable_stock_balance to authenticated;
