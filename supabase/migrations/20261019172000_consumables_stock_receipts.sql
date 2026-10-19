create table if not exists public.consumable_stock_receipts (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null,
 resource_id text not null,
 quantity numeric not null check(quantity > 0),
 note text,
 created_at timestamptz not null default now()
);
create index if not exists consumable_stock_receipts_lookup on public.consumable_stock_receipts(organization_id,resource_id);
alter table public.consumable_stock_receipts enable row level security;
revoke all on public.consumable_stock_receipts from anon, authenticated;
grant select,insert on public.consumable_stock_receipts to authenticated;
create policy receipts_read on public.consumable_stock_receipts for select to authenticated
 using (organization_id=public.current_organization_id());
create policy receipts_write on public.consumable_stock_receipts for insert to authenticated
 with check (organization_id=public.current_organization_id());
