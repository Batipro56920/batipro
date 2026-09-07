alter table public.suppliers
  add column if not exists contact_name text null;
