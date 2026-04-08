create table if not exists public.chantier_consignes (
  id uuid primary key default gen_random_uuid(),
  chantier_id uuid not null references public.chantiers(id) on delete cascade,
  author_id uuid null default auth.uid(),
  title text not null,
  description text not null,
  priority text not null default 'normale',
  date_debut date not null default current_date,
  date_fin date null,
  task_id uuid null references public.chantier_tasks(id) on delete set null,
  applies_to_all boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chantier_consignes_priority_chk check (priority in ('normale', 'importante', 'urgente')),
  constraint chantier_consignes_date_range_chk check (date_fin is null or date_fin >= date_debut)
);

create index if not exists chantier_consignes_chantier_idx
  on public.chantier_consignes(chantier_id, date_debut desc, created_at desc);

create index if not exists chantier_consignes_task_idx
  on public.chantier_consignes(task_id);

create table if not exists public.chantier_consigne_intervenants (
  consigne_id uuid not null references public.chantier_consignes(id) on delete cascade,
  intervenant_id uuid not null references public.intervenants(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (consigne_id, intervenant_id)
);

create index if not exists chantier_consigne_intervenants_intervenant_idx
  on public.chantier_consigne_intervenants(intervenant_id, consigne_id);

create table if not exists public.chantier_consigne_reads (
  consigne_id uuid not null references public.chantier_consignes(id) on delete cascade,
  intervenant_id uuid not null references public.intervenants(id) on delete cascade,
  read_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (consigne_id, intervenant_id)
);

create index if not exists chantier_consigne_reads_intervenant_idx
  on public.chantier_consigne_reads(intervenant_id, read_at desc);

alter table public.chantier_consignes enable row level security;
alter table public.chantier_consigne_intervenants enable row level security;
alter table public.chantier_consigne_reads enable row level security;

do $$
begin
  if exists (
    select 1
    from pg_proc
    where proname = 'set_updated_at'
  ) then
    drop trigger if exists trg_chantier_consignes_updated_at on public.chantier_consignes;
    create trigger trg_chantier_consignes_updated_at
    before update on public.chantier_consignes
    for each row execute function public.set_updated_at();
  end if;
end $$;

create or replace function public._chantier_consigne_is_admin()
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

revoke all on function public._chantier_consigne_is_admin() from public;

grant select, insert, update, delete on table public.chantier_consignes to authenticated;
grant select, insert, update, delete on table public.chantier_consigne_intervenants to authenticated;
grant select, insert, update, delete on table public.chantier_consigne_reads to authenticated;

grant select, insert, update, delete on table public.chantier_consignes to service_role;
grant select, insert, update, delete on table public.chantier_consigne_intervenants to service_role;
grant select, insert, update, delete on table public.chantier_consigne_reads to service_role;

drop policy if exists chantier_consignes_admin_all on public.chantier_consignes;
create policy chantier_consignes_admin_all
  on public.chantier_consignes
  for all
  to authenticated
  using (public._chantier_consigne_is_admin())
  with check (public._chantier_consigne_is_admin());

drop policy if exists chantier_consigne_intervenants_admin_all on public.chantier_consigne_intervenants;
create policy chantier_consigne_intervenants_admin_all
  on public.chantier_consigne_intervenants
  for all
  to authenticated
  using (public._chantier_consigne_is_admin())
  with check (public._chantier_consigne_is_admin());

drop policy if exists chantier_consigne_reads_admin_all on public.chantier_consigne_reads;
create policy chantier_consigne_reads_admin_all
  on public.chantier_consigne_reads
  for all
  to authenticated
  using (public._chantier_consigne_is_admin())
  with check (public._chantier_consigne_is_admin());

drop function if exists public.intervenant_consigne_list(text, uuid);
create or replace function public.intervenant_consigne_list(
  p_token text,
  p_chantier_id uuid default null
)
returns table (
  id uuid,
  chantier_id uuid,
  chantier_nom text,
  title text,
  description text,
  priority text,
  date_debut date,
  date_fin date,
  task_id uuid,
  task_titre text,
  applies_to_all boolean,
  is_read boolean,
  read_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ctx record;
begin
  select *
  into v_ctx
  from public._intervenant_token_context_v2(p_token)
  limit 1;

  if v_ctx.intervenant_id is null then
    raise exception 'intervenant_required';
  end if;

  if p_chantier_id is not null then
    perform public._intervenant_assert_chantier_access(p_token, p_chantier_id);
  end if;

  return query
  select
    c.id,
    c.chantier_id,
    ch.nom as chantier_nom,
    c.title,
    c.description,
    c.priority,
    c.date_debut,
    c.date_fin,
    c.task_id,
    t.titre as task_titre,
    c.applies_to_all,
    (r.read_at is not null) as is_read,
    r.read_at,
    c.created_at,
    c.updated_at
  from public.chantier_consignes c
  join public.chantiers ch on ch.id = c.chantier_id
  left join public.chantier_tasks t on t.id = c.task_id
  left join public.chantier_consigne_reads r
    on r.consigne_id = c.id
   and r.intervenant_id = v_ctx.intervenant_id
  where (
      (p_chantier_id is null and c.chantier_id = any(v_ctx.chantier_ids))
      or (p_chantier_id is not null and c.chantier_id = p_chantier_id)
    )
    and (
      c.applies_to_all
      or exists (
        select 1
        from public.chantier_consigne_intervenants ci
        where ci.consigne_id = c.id
          and ci.intervenant_id = v_ctx.intervenant_id
      )
    )
  order by c.date_debut desc, c.created_at desc;
end;
$$;

revoke all on function public.intervenant_consigne_list(text, uuid) from public;
grant execute on function public.intervenant_consigne_list(text, uuid) to anon, authenticated;

drop function if exists public.intervenant_consigne_mark_read(text, uuid);
create or replace function public.intervenant_consigne_mark_read(
  p_token text,
  p_consigne_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ctx record;
  v_consigne record;
  v_read_at timestamptz := now();
begin
  if p_consigne_id is null then
    raise exception 'consigne_id_required';
  end if;

  select *
  into v_ctx
  from public._intervenant_token_context_v2(p_token)
  limit 1;

  if v_ctx.intervenant_id is null then
    raise exception 'intervenant_required';
  end if;

  select c.id, c.chantier_id, c.applies_to_all
  into v_consigne
  from public.chantier_consignes c
  where c.id = p_consigne_id
    and c.chantier_id = any(v_ctx.chantier_ids)
    and (
      c.applies_to_all
      or exists (
        select 1
        from public.chantier_consigne_intervenants ci
        where ci.consigne_id = c.id
          and ci.intervenant_id = v_ctx.intervenant_id
      )
    )
  limit 1;

  if v_consigne.id is null then
    raise exception 'consigne_not_found';
  end if;

  insert into public.chantier_consigne_reads (consigne_id, intervenant_id, read_at)
  values (v_consigne.id, v_ctx.intervenant_id, v_read_at)
  on conflict (consigne_id, intervenant_id)
  do update set read_at = excluded.read_at;

  return jsonb_build_object(
    'id', v_consigne.id,
    'chantier_id', v_consigne.chantier_id,
    'intervenant_id', v_ctx.intervenant_id,
    'read_at', v_read_at
  );
end;
$$;

revoke all on function public.intervenant_consigne_mark_read(text, uuid) from public;
grant execute on function public.intervenant_consigne_mark_read(text, uuid) to anon, authenticated;
