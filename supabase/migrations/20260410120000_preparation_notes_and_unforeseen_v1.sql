create or replace function public.batipro_can_manage_chantier_preparation_notes()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'ADMIN'
  );
$$;

revoke all on function public.batipro_can_manage_chantier_preparation_notes() from public;
grant execute on function public.batipro_can_manage_chantier_preparation_notes() to authenticated;

create or replace function public.batipro_can_manage_chantier_unforeseen()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'ADMIN'
  );
$$;

revoke all on function public.batipro_can_manage_chantier_unforeseen() from public;
grant execute on function public.batipro_can_manage_chantier_unforeseen() to authenticated;

create or replace function public.batipro_can_validate_chantier_unforeseen()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'ADMIN'
  );
$$;

revoke all on function public.batipro_can_validate_chantier_unforeseen() from public;
grant execute on function public.batipro_can_validate_chantier_unforeseen() to authenticated;

create table if not exists public.chantier_preparation_notes (
  id uuid primary key default gen_random_uuid(),
  chantier_id uuid not null references public.chantiers(id) on delete cascade,
  title text not null,
  content text not null,
  status text not null default 'actif',
  author_id uuid null references public.profiles(id) on delete set null,
  author_name text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chantier_preparation_notes_status_chk
    check (status in ('actif', 'traite', 'archive'))
);

create index if not exists chantier_preparation_notes_chantier_idx
  on public.chantier_preparation_notes (chantier_id, updated_at desc);

create index if not exists chantier_preparation_notes_status_idx
  on public.chantier_preparation_notes (status, updated_at desc);

alter table public.chantier_preparation_notes enable row level security;

drop policy if exists chantier_preparation_notes_select on public.chantier_preparation_notes;
create policy chantier_preparation_notes_select
  on public.chantier_preparation_notes
  for select
  to authenticated
  using (auth.uid() is not null);

drop policy if exists chantier_preparation_notes_insert on public.chantier_preparation_notes;
create policy chantier_preparation_notes_insert
  on public.chantier_preparation_notes
  for insert
  to authenticated
  with check (public.batipro_can_manage_chantier_preparation_notes());

drop policy if exists chantier_preparation_notes_update on public.chantier_preparation_notes;
create policy chantier_preparation_notes_update
  on public.chantier_preparation_notes
  for update
  to authenticated
  using (public.batipro_can_manage_chantier_preparation_notes())
  with check (public.batipro_can_manage_chantier_preparation_notes());

drop policy if exists chantier_preparation_notes_delete on public.chantier_preparation_notes;
create policy chantier_preparation_notes_delete
  on public.chantier_preparation_notes
  for delete
  to authenticated
  using (public.batipro_can_manage_chantier_preparation_notes());

do $$
begin
  if exists (
    select 1
    from pg_proc
    where proname = 'set_updated_at'
  ) then
    drop trigger if exists trg_chantier_preparation_notes_updated_at on public.chantier_preparation_notes;
    create trigger trg_chantier_preparation_notes_updated_at
    before update on public.chantier_preparation_notes
    for each row execute function public.set_updated_at();
  end if;
end $$;

do $$
begin
  if to_regclass('public.chantier_change_orders') is not null then
    alter table public.chantier_change_orders
      add column if not exists devis_ligne_id uuid null references public.devis_lignes(id) on delete set null;

    update public.chantier_change_orders
    set statut = case
      when statut = 'a_valider' then 'en_attente_validation'
      when statut = 'integre' then 'realise'
      else statut
    end
    where statut in ('a_valider', 'integre');

    alter table public.chantier_change_orders
      alter column statut set default 'a_analyser';

    alter table public.chantier_change_orders
      drop constraint if exists chantier_change_orders_statut_chk;

    alter table public.chantier_change_orders
      add constraint chantier_change_orders_statut_chk
      check (
        statut in (
          'a_analyser',
          'a_chiffrer',
          'en_attente_validation',
          'valide',
          'refuse',
          'realise'
        )
      );

    create index if not exists chantier_change_orders_devis_ligne_idx
      on public.chantier_change_orders (devis_ligne_id);

    drop policy if exists chantier_change_orders_admin_all on public.chantier_change_orders;
    drop policy if exists chantier_change_orders_select on public.chantier_change_orders;
    drop policy if exists chantier_change_orders_insert on public.chantier_change_orders;
    drop policy if exists chantier_change_orders_update on public.chantier_change_orders;
    drop policy if exists chantier_change_orders_delete on public.chantier_change_orders;

    create policy chantier_change_orders_select
      on public.chantier_change_orders
      for select
      to authenticated
      using (auth.uid() is not null);

    create policy chantier_change_orders_insert
      on public.chantier_change_orders
      for insert
      to authenticated
      with check (public.batipro_can_manage_chantier_unforeseen());

    create policy chantier_change_orders_update
      on public.chantier_change_orders
      for update
      to authenticated
      using (public.batipro_can_manage_chantier_unforeseen())
      with check (public.batipro_can_manage_chantier_unforeseen());

    create policy chantier_change_orders_delete
      on public.chantier_change_orders
      for delete
      to authenticated
      using (public.batipro_can_manage_chantier_unforeseen());
  end if;
end $$;
