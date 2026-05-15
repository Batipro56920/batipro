alter table if exists public.intervenants
  add column if not exists entreprise text,
  add column if not exists metier text,
  add column if not exists notes text,
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists invitation_last_sent_at timestamptz;

update public.intervenants i
set user_id = iu.user_id
from public.intervenant_users iu
where iu.intervenant_id = i.id
  and i.user_id is null;

create table if not exists public.intervenant_account_invitations (
  id uuid primary key default gen_random_uuid(),
  intervenant_id uuid not null references public.intervenants(id) on delete cascade,
  email text not null,
  token text not null,
  created_by uuid null references auth.users(id) on delete set null,
  linked_user_id uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '14 days'),
  used_at timestamptz null,
  revoked_at timestamptz null
);

create unique index if not exists intervenant_account_invitations_token_uniq
  on public.intervenant_account_invitations(token);

create index if not exists intervenant_account_invitations_intervenant_idx
  on public.intervenant_account_invitations(intervenant_id, created_at desc);

alter table if exists public.intervenant_account_invitations enable row level security;

drop policy if exists intervenant_account_invitations_admin_select on public.intervenant_account_invitations;
create policy intervenant_account_invitations_admin_select
  on public.intervenant_account_invitations
  for select
  to authenticated
  using (public.batipro_is_admin());

drop policy if exists intervenant_account_invitations_admin_insert on public.intervenant_account_invitations;
create policy intervenant_account_invitations_admin_insert
  on public.intervenant_account_invitations
  for insert
  to authenticated
  with check (public.batipro_is_admin());

drop policy if exists intervenant_account_invitations_admin_update on public.intervenant_account_invitations;
create policy intervenant_account_invitations_admin_update
  on public.intervenant_account_invitations
  for update
  to authenticated
  using (public.batipro_is_admin())
  with check (public.batipro_is_admin());

drop policy if exists intervenant_account_invitations_admin_delete on public.intervenant_account_invitations;
create policy intervenant_account_invitations_admin_delete
  on public.intervenant_account_invitations
  for delete
  to authenticated
  using (public.batipro_is_admin());

drop policy if exists "delete intervenants" on public.intervenants;
drop policy if exists "insert intervenants" on public.intervenants;
drop policy if exists "read intervenants" on public.intervenants;
drop policy if exists "update intervenants" on public.intervenants;

drop policy if exists intervenants_admin_select on public.intervenants;
create policy intervenants_admin_select
  on public.intervenants
  for select
  to authenticated
  using (public.batipro_is_admin());

drop policy if exists intervenants_admin_insert on public.intervenants;
create policy intervenants_admin_insert
  on public.intervenants
  for insert
  to authenticated
  with check (public.batipro_is_admin());

drop policy if exists intervenants_admin_update on public.intervenants;
create policy intervenants_admin_update
  on public.intervenants
  for update
  to authenticated
  using (public.batipro_is_admin())
  with check (public.batipro_is_admin());

drop policy if exists intervenants_admin_delete on public.intervenants;
create policy intervenants_admin_delete
  on public.intervenants
  for delete
  to authenticated
  using (public.batipro_is_admin());

drop policy if exists intervenants_self_select on public.intervenants;
create policy intervenants_self_select
  on public.intervenants
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.intervenant_users iu
      where iu.user_id = auth.uid()
        and iu.intervenant_id = intervenants.id
    )
  );

drop function if exists public.intervenant_current_user_id();
create or replace function public.intervenant_current_user_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid();
$$;

revoke all on function public.intervenant_current_user_id() from public;
grant execute on function public.intervenant_current_user_id() to anon, authenticated;

drop function if exists public._intervenant_current_id();
create or replace function public._intervenant_current_id()
returns uuid
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_intervenant_id uuid;
begin
  if auth.uid() is null then
    return null;
  end if;

  select i.id
  into v_intervenant_id
  from public.intervenants i
  where i.user_id = auth.uid()
  limit 1;

  if v_intervenant_id is not null then
    return v_intervenant_id;
  end if;

  select iu.intervenant_id
  into v_intervenant_id
  from public.intervenant_users iu
  where iu.user_id = auth.uid()
  limit 1;

  return v_intervenant_id;
end;
$$;

revoke all on function public._intervenant_current_id() from public;

drop function if exists public._intervenant_collect_chantier_ids(uuid);
create or replace function public._intervenant_collect_chantier_ids(p_intervenant_id uuid)
returns uuid[]
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with chantier_sources as (
    select ci.chantier_id
    from public.chantier_intervenants ci
    where ci.intervenant_id = p_intervenant_id

    union

    select i.chantier_id
    from public.intervenants i
    where i.id = p_intervenant_id
      and i.chantier_id is not null
  )
  select coalesce(array_agg(distinct chantier_id), '{}'::uuid[])
  from chantier_sources;
$$;

revoke all on function public._intervenant_collect_chantier_ids(uuid) from public;

drop function if exists public._intervenant_token_context_v2(text);
create or replace function public._intervenant_token_context_v2(p_token text)
returns table (
  token text,
  intervenant_id uuid,
  access_email text,
  access_role text,
  scope text,
  expires_at timestamptz,
  chantier_ids uuid[],
  default_chantier_id uuid
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_token text;
  v_distinct_intervenants integer;
  v_intervenant_id uuid;
  v_email text;
  v_chantier_ids uuid[];
  v_default_chantier_id uuid;
begin
  v_token := nullif(btrim(p_token), '');

  if v_token is null then
    if auth.uid() is null then
      raise exception 'invalid_or_expired_token';
    end if;

    v_intervenant_id := public._intervenant_current_id();
    if v_intervenant_id is null then
      raise exception 'intervenant_required';
    end if;

    select
      i.email,
      i.chantier_id
    into
      v_email,
      v_default_chantier_id
    from public.intervenants i
    where i.id = v_intervenant_id;

    v_chantier_ids := public._intervenant_collect_chantier_ids(v_intervenant_id);

    if v_default_chantier_id is null then
      select min(cid)
      into v_default_chantier_id
      from unnest(v_chantier_ids) as cid;
    end if;

    return query
    select
      null::text,
      v_intervenant_id,
      coalesce(nullif(btrim(coalesce(auth.jwt() ->> 'email', '')), ''), nullif(btrim(coalesce(v_email, '')), '')),
      'INTERVENANT'::text,
      'AUTH_SESSION'::text,
      null::timestamptz,
      coalesce(v_chantier_ids, '{}'::uuid[]),
      v_default_chantier_id;
    return;
  end if;

  select count(*)::integer
  into v_distinct_intervenants
  from (
    select distinct coalesce(ca.intervenant_id::text, '__NULL__') as intervenant_key
    from public.chantier_access ca
    where ca.token = v_token
      and ca.revoked_at is null
      and ca.expires_at > now()
  ) s;

  if v_distinct_intervenants = 0 then
    raise exception 'invalid_or_expired_token';
  end if;

  if v_distinct_intervenants > 1 then
    raise exception 'invalid_token_scope';
  end if;

  return query
  select
    v_token as token,
    max(ca.intervenant_id) as intervenant_id,
    max(ca.email) as access_email,
    max(coalesce(ca.role, 'INTERVENANT')) as access_role,
    max(coalesce(ca.scope, 'INTERVENANT_PORTAL')) as scope,
    min(ca.expires_at) as expires_at,
    array_agg(distinct ca.chantier_id) as chantier_ids,
    min(ca.chantier_id) as default_chantier_id
  from public.chantier_access ca
  where ca.token = v_token
    and ca.revoked_at is null
    and ca.expires_at > now()
  group by ca.token;
end;
$$;

revoke all on function public._intervenant_token_context_v2(text) from public;

drop function if exists public._intervenant_assert_chantier_access(text, uuid);
create or replace function public._intervenant_assert_chantier_access(
  p_token text,
  p_chantier_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ctx record;
begin
  if p_chantier_id is null then
    raise exception 'chantier_id_required';
  end if;

  select *
  into v_ctx
  from public._intervenant_token_context_v2(p_token)
  limit 1;

  if not (p_chantier_id = any(coalesce(v_ctx.chantier_ids, '{}'::uuid[]))) then
    raise exception 'forbidden_token_scope';
  end if;

  return v_ctx.intervenant_id;
end;
$$;

revoke all on function public._intervenant_assert_chantier_access(text, uuid) from public;

drop function if exists public.intervenant_session(text);
create or replace function public.intervenant_session(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ctx record;
  v_intervenant jsonb;
  v_chantiers jsonb;
begin
  select *
  into v_ctx
  from public._intervenant_token_context_v2(p_token)
  limit 1;

  select jsonb_build_object(
    'id', i.id,
    'nom', i.nom,
    'email', i.email,
    'telephone', i.telephone,
    'entreprise', i.entreprise,
    'metier', i.metier,
    'notes', i.notes
  )
  into v_intervenant
  from public.intervenants i
  where i.id = v_ctx.intervenant_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', c.id,
        'nom', c.nom,
        'client', c.client,
        'adresse', c.adresse,
        'status', c.status,
        'avancement', c.avancement,
        'date_debut', c.date_debut,
        'date_fin_prevue', c.date_fin_prevue,
        'planning_start_date', c.planning_start_date,
        'planning_end_date', c.planning_end_date,
        'created_at', c.created_at
      )
      order by c.nom
    ),
    '[]'::jsonb
  )
  into v_chantiers
  from public.chantiers c
  where c.id = any(coalesce(v_ctx.chantier_ids, '{}'::uuid[]));

  return jsonb_build_object(
    'token', v_ctx.token,
    'intervenant_id', v_ctx.intervenant_id,
    'email', v_ctx.access_email,
    'role', v_ctx.access_role,
    'scope', v_ctx.scope,
    'expires_at', v_ctx.expires_at,
    'chantier_id', v_ctx.default_chantier_id,
    'default_chantier_id', v_ctx.default_chantier_id,
    'intervenant', coalesce(v_intervenant, '{}'::jsonb),
    'chantiers', coalesce(v_chantiers, '[]'::jsonb)
  );
end;
$$;

drop function if exists public.intervenant_get_chantiers(text);
create or replace function public.intervenant_get_chantiers(p_token text)
returns table (
  id uuid,
  nom text,
  client text,
  adresse text,
  status text,
  avancement numeric,
  date_debut date,
  date_fin_prevue date,
  planning_start_date date,
  planning_end_date date,
  created_at timestamptz
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

  return query
  select distinct
    c.id,
    c.nom,
    c.client,
    c.adresse,
    c.status,
    c.avancement,
    c.date_debut,
    c.date_fin_prevue,
    c.planning_start_date,
    c.planning_end_date,
    c.created_at
  from public.chantiers c
  where c.id = any(coalesce(v_ctx.chantier_ids, '{}'::uuid[]))
  order by c.nom;
end;
$$;

grant execute on function public.intervenant_current_user_id() to anon, authenticated;
grant execute on function public.intervenant_session(text) to anon, authenticated;
grant execute on function public.intervenant_get_chantiers(text) to anon, authenticated;
