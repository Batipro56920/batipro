-- RLS access for chantier_lot_planning based on chantier_access(user_id)

alter table if exists public.chantier_lot_planning
  add column if not exists end_date_locked boolean not null default false;

alter table if exists public.chantier_access
  add column if not exists user_id uuid references auth.users(id) on delete set null;

create index if not exists chantier_access_user_chantier_idx
  on public.chantier_access(user_id, chantier_id);

-- Backfill user_id from intervenant link table when available
do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'intervenant_users'
  ) then
    update public.chantier_access ca
    set user_id = iu.user_id
    from public.intervenant_users iu
    where ca.user_id is null
      and ca.intervenant_id is not null
      and iu.intervenant_id = ca.intervenant_id;
  end if;
end $$;

-- Backfill remaining rows by email match
update public.chantier_access ca
set user_id = u.id
from auth.users u
where ca.user_id is null
  and lower(coalesce(ca.email, '')) <> ''
  and lower(ca.email) = lower(u.email);

alter table if exists public.chantier_lot_planning enable row level security;

drop policy if exists chantier_lot_planning_admin_all on public.chantier_lot_planning;
drop policy if exists chantier_lot_planning_select_access on public.chantier_lot_planning;
drop policy if exists chantier_lot_planning_insert_access on public.chantier_lot_planning;
drop policy if exists chantier_lot_planning_update_access on public.chantier_lot_planning;

create policy chantier_lot_planning_select_access
  on public.chantier_lot_planning
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.chantier_access ca
      where ca.chantier_id = chantier_lot_planning.chantier_id
        and ca.user_id = auth.uid()
    )
  );

create policy chantier_lot_planning_insert_access
  on public.chantier_lot_planning
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.chantier_access ca
      where ca.chantier_id = chantier_lot_planning.chantier_id
        and ca.user_id = auth.uid()
    )
  );

create policy chantier_lot_planning_update_access
  on public.chantier_lot_planning
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.chantier_access ca
      where ca.chantier_id = chantier_lot_planning.chantier_id
        and ca.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.chantier_access ca
      where ca.chantier_id = chantier_lot_planning.chantier_id
        and ca.user_id = auth.uid()
    )
  );

grant select, insert, update on table public.chantier_lot_planning to authenticated;
