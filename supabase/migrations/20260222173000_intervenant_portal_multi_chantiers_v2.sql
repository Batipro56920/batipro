-- Intervenant portal v2
-- Flow unique: /intervenant?token=...
-- Token opaque (DB), validation SQL SECURITY DEFINER, multi-chantiers

-- ---------------------------------------------------------------------------
-- 1) chantier_access: multi-chantiers per token
-- ---------------------------------------------------------------------------
alter table if exists public.chantier_access
  add column if not exists revoked_at timestamptz,
  add column if not exists scope text;

update public.chantier_access
set scope = 'INTERVENANT_PORTAL'
where scope is null or btrim(scope) = '';

alter table if exists public.chantier_access
  alter column scope set default 'INTERVENANT_PORTAL';

do $$
begin
  if to_regclass('public.chantier_access') is not null then
    if exists (
      select 1
      from pg_constraint
      where conrelid = 'public.chantier_access'::regclass
        and conname = 'chantier_access_token_key'
    ) then
      alter table public.chantier_access
        drop constraint chantier_access_token_key;
    end if;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3) task comments + time entries (portal MVP)
-- ---------------------------------------------------------------------------
create table if not exists public.chantier_task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.chantier_tasks(id) on delete cascade,
  chantier_id uuid not null references public.chantiers(id) on delete cascade,
  intervenant_id uuid null references public.intervenants(id) on delete set null,
  message text not null,
  photos jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists chantier_task_comments_task_idx
  on public.chantier_task_comments(task_id);

create index if not exists chantier_task_comments_chantier_idx
  on public.chantier_task_comments(chantier_id, created_at desc);

create index if not exists chantier_task_comments_intervenant_idx
  on public.chantier_task_comments(intervenant_id);

alter table if exists public.chantier_task_comments enable row level security;

drop policy if exists chantier_task_comments_admin_all on public.chantier_task_comments;
create policy chantier_task_comments_admin_all
  on public.chantier_task_comments
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'ADMIN'
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'ADMIN'
    )
  );

create table if not exists public.chantier_time_entries (
  id uuid primary key default gen_random_uuid(),
  chantier_id uuid not null references public.chantiers(id) on delete cascade,
  task_id uuid null references public.chantier_tasks(id) on delete set null,
  intervenant_id uuid not null references public.intervenants(id) on delete cascade,
  work_date date not null default current_date,
  duration_hours numeric not null,
  note text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chantier_time_entries_duration_chk check (duration_hours > 0)
);

create index if not exists chantier_time_entries_chantier_idx
  on public.chantier_time_entries(chantier_id, work_date desc);

create index if not exists chantier_time_entries_intervenant_idx
  on public.chantier_time_entries(intervenant_id, work_date desc);

create index if not exists chantier_time_entries_task_idx
  on public.chantier_time_entries(task_id);

alter table if exists public.chantier_time_entries enable row level security;

drop policy if exists chantier_time_entries_admin_all on public.chantier_time_entries;
create policy chantier_time_entries_admin_all
  on public.chantier_time_entries
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'ADMIN'
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'ADMIN'
    )
  );

do $$
begin
  if to_regclass('public.chantier_time_entries') is not null
     and exists (
       select 1
       from pg_proc
       where proname = 'set_updated_at'
     ) then
    drop trigger if exists trg_chantier_time_entries_updated_at on public.chantier_time_entries;
    create trigger trg_chantier_time_entries_updated_at
    before update on public.chantier_time_entries
    for each row execute function public.set_updated_at();
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 4) helper functions (security definer)
-- ---------------------------------------------------------------------------
drop function if exists public._assert_admin_authenticated();
create or replace function public._assert_admin_authenticated()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'forbidden';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'ADMIN'
  ) then
    raise exception 'forbidden';
  end if;
end;
$$;

revoke all on function public._assert_admin_authenticated() from public;

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
begin
  v_token := nullif(btrim(p_token), '');
  if v_token is null then
    raise exception 'invalid_or_expired_token';
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

  if not (p_chantier_id = any(v_ctx.chantier_ids)) then
    raise exception 'forbidden_token_scope';
  end if;

  return v_ctx.intervenant_id;
end;
$$;

revoke all on function public._intervenant_assert_chantier_access(text, uuid) from public;

-- Material status helpers (must exist before RPCs using them)
drop function if exists public._materiel_normalize_statut(text, text);
create or replace function public._materiel_normalize_statut(p_statut text, p_status text default null)
returns text
language sql
immutable
as $$
  select case upper(coalesce(nullif(btrim(p_statut), ''), nullif(btrim(p_status), ''), 'EN_ATTENTE'))
    when 'EN_ATTENTE' then 'en_attente'
    when 'EN ATTENTE' then 'en_attente'
    when 'A_COMMANDER' then 'en_attente'
    when 'A COMMANDER' then 'en_attente'
    when 'ENVOYE' then 'en_attente'
    when 'A_FAIRE' then 'en_attente'
    when 'VALIDE' then 'validee'
    when 'VALIDEE' then 'validee'
    when 'COMMANDE' then 'validee'
    when 'REFUSE' then 'refusee'
    when 'REFUSEE' then 'refusee'
    when 'LIVRE' then 'livree'
    when 'LIVREE' then 'livree'
    else 'en_attente'
  end;
$$;

drop function if exists public._materiel_legacy_status_from_statut(text);
create or replace function public._materiel_legacy_status_from_statut(p_statut text)
returns text
language sql
immutable
as $$
  select case public._materiel_normalize_statut(p_statut, null)
    when 'en_attente' then 'A_COMMANDER'
    when 'validee' then 'COMMANDE'
    when 'refusee' then 'REFUSEE'
    when 'livree' then 'LIVRE'
    else 'A_COMMANDER'
  end;
$$;

-- ---------------------------------------------------------------------------
-- 5) admin RPC (token management)
-- ---------------------------------------------------------------------------
drop function if exists public.admin_create_intervenant_link(uuid, uuid, timestamptz);
create or replace function public.admin_create_intervenant_link(
  p_chantier_id uuid,
  p_intervenant_id uuid,
  p_expires_at timestamptz default null
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_token text;
  v_email text;
  v_expires timestamptz;
  v_try integer := 0;
begin
  perform public._assert_admin_authenticated();

  if p_chantier_id is null then
    raise exception 'chantier_id_required';
  end if;

  if not exists (
    select 1
    from public.chantiers c
    where c.id = p_chantier_id
  ) then
    raise exception 'chantier_not_found';
  end if;

  if p_intervenant_id is not null then
    select i.email
    into v_email
    from public.intervenants i
    where i.id = p_intervenant_id
    limit 1;

    if not found then
      raise exception 'intervenant_not_found';
    end if;
  end if;

  v_email := nullif(btrim(coalesce(v_email, '')), '');
  if v_email is null then
    v_email := 'token+' || substr(md5(random()::text || clock_timestamp()::text), 1, 12) || '@batipro.local';
  end if;

  v_expires := coalesce(p_expires_at, now() + interval '30 days');
  if v_expires <= now() then
    raise exception 'invalid_expiration';
  end if;

  select ca.token
  into v_token
  from public.chantier_access ca
  where ca.intervenant_id is not distinct from p_intervenant_id
    and ca.revoked_at is null
    and ca.expires_at > now()
  order by ca.expires_at desc, ca.created_at desc
  limit 1;

  if v_token is null then
    loop
      v_try := v_try + 1;
      v_token := translate(encode(gen_random_bytes(24), 'base64'), E'+/=\n\r', '-___');
      v_token := regexp_replace(v_token, '[^A-Za-z0-9_-]', '', 'g');
      exit when v_token <> ''
        and not exists (select 1 from public.chantier_access ca where ca.token = v_token);

      if v_try >= 10 then
        raise exception 'token_generation_failed';
      end if;
    end loop;
  end if;

  insert into public.chantier_access (
    chantier_id,
    intervenant_id,
    email,
    role,
    token,
    expires_at,
    used_at,
    revoked_at,
    scope
  ) values (
    p_chantier_id,
    p_intervenant_id,
    v_email,
    'INTERVENANT',
    v_token,
    v_expires,
    null,
    null,
    'INTERVENANT_PORTAL'
  )
  on conflict (token, chantier_id)
  do update set
    intervenant_id = excluded.intervenant_id,
    email = excluded.email,
    role = excluded.role,
    expires_at = greatest(public.chantier_access.expires_at, excluded.expires_at),
    revoked_at = null,
    scope = excluded.scope;

  update public.chantier_access
  set
    expires_at = greatest(expires_at, v_expires),
    revoked_at = null
  where token = v_token;

  return v_token;
end;
$$;

drop function if exists public.admin_create_intervenant_link(uuid, timestamptz);
create or replace function public.admin_create_intervenant_link(
  p_chantier_id uuid,
  p_expires_at timestamptz default null
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return public.admin_create_intervenant_link(p_chantier_id, null, p_expires_at);
end;
$$;

drop function if exists public.admin_set_intervenant_link_chantiers(uuid, uuid[], timestamptz, text);
create or replace function public.admin_set_intervenant_link_chantiers(
  p_intervenant_id uuid,
  p_chantier_ids uuid[],
  p_expires_at timestamptz default null,
  p_existing_token text default null
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_email text;
  v_token text;
  v_expires timestamptz;
  v_first_chantier uuid;
  v_chantier_id uuid;
begin
  perform public._assert_admin_authenticated();

  if p_intervenant_id is null then
    raise exception 'intervenant_id_required';
  end if;

  select i.email
  into v_email
  from public.intervenants i
  where i.id = p_intervenant_id
  limit 1;

  if not found then
    raise exception 'intervenant_not_found';
  end if;

  select min(cid)
  into v_first_chantier
  from (
    select distinct unnest(p_chantier_ids) as cid
  ) s;

  if v_first_chantier is null then
    raise exception 'chantier_ids_required';
  end if;

  v_expires := coalesce(p_expires_at, now() + interval '30 days');
  v_token := nullif(btrim(coalesce(p_existing_token, '')), '');

  if v_token is null then
    v_token := public.admin_create_intervenant_link(v_first_chantier, p_intervenant_id, v_expires);
  else
    insert into public.chantier_access (
      chantier_id,
      intervenant_id,
      email,
      role,
      token,
      expires_at,
      revoked_at,
      scope
    ) values (
      v_first_chantier,
      p_intervenant_id,
      coalesce(nullif(btrim(v_email), ''), 'token+' || substr(md5(random()::text), 1, 12) || '@batipro.local'),
      'INTERVENANT',
      v_token,
      v_expires,
      null,
      'INTERVENANT_PORTAL'
    )
    on conflict (token, chantier_id)
    do update set
      intervenant_id = excluded.intervenant_id,
      email = excluded.email,
      expires_at = greatest(public.chantier_access.expires_at, excluded.expires_at),
      revoked_at = null,
      scope = excluded.scope;
  end if;

  for v_chantier_id in
    select distinct unnest(p_chantier_ids)
  loop
    if v_chantier_id is null then
      continue;
    end if;

    if not exists (select 1 from public.chantiers c where c.id = v_chantier_id) then
      continue;
    end if;

    insert into public.chantier_access (
      chantier_id,
      intervenant_id,
      email,
      role,
      token,
      expires_at,
      revoked_at,
      scope
    ) values (
      v_chantier_id,
      p_intervenant_id,
      coalesce(nullif(btrim(v_email), ''), 'token+' || substr(md5(random()::text), 1, 12) || '@batipro.local'),
      'INTERVENANT',
      v_token,
      v_expires,
      null,
      'INTERVENANT_PORTAL'
    )
    on conflict (token, chantier_id)
    do update set
      intervenant_id = excluded.intervenant_id,
      email = excluded.email,
      expires_at = greatest(public.chantier_access.expires_at, excluded.expires_at),
      revoked_at = null,
      scope = excluded.scope;
  end loop;

  update public.chantier_access
  set
    expires_at = greatest(expires_at, v_expires),
    revoked_at = null
  where token = v_token;

  return v_token;
end;
$$;

drop function if exists public.admin_remove_intervenant_link_chantiers(text, uuid[]);
create or replace function public.admin_remove_intervenant_link_chantiers(
  p_token text,
  p_chantier_ids uuid[]
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_token text;
  v_count integer := 0;
begin
  perform public._assert_admin_authenticated();

  v_token := nullif(btrim(p_token), '');
  if v_token is null then
    raise exception 'token_required';
  end if;

  if p_chantier_ids is null or coalesce(array_length(p_chantier_ids, 1), 0) = 0 then
    raise exception 'chantier_ids_required';
  end if;

  update public.chantier_access ca
  set revoked_at = now()
  where ca.token = v_token
    and ca.chantier_id = any(p_chantier_ids)
    and ca.revoked_at is null;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

drop function if exists public.admin_revoke_intervenant_link(text);
create or replace function public.admin_revoke_intervenant_link(p_token text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_token text;
begin
  perform public._assert_admin_authenticated();

  v_token := nullif(btrim(p_token), '');
  if v_token is null then
    raise exception 'token_required';
  end if;

  update public.chantier_access ca
  set revoked_at = now()
  where ca.token = v_token
    and ca.revoked_at is null;

  return found;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6) intervenant RPCs
-- ---------------------------------------------------------------------------
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
    'telephone', i.telephone
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
  from public.chantier_access ca
  join public.chantiers c
    on c.id = ca.chantier_id
  where ca.token = v_ctx.token
    and ca.revoked_at is null
    and ca.expires_at > now();

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
  from public.chantier_access ca
  join public.chantiers c
    on c.id = ca.chantier_id
  where ca.token = v_ctx.token
    and ca.revoked_at is null
    and ca.expires_at > now()
  order by c.nom;
end;
$$;

drop function if exists public.intervenant_get_tasks(text, uuid);
create or replace function public.intervenant_get_tasks(p_token text, p_chantier_id uuid)
returns table (
  id uuid,
  chantier_id uuid,
  titre text,
  status text,
  lot text,
  corps_etat text,
  date date,
  date_debut date,
  date_fin date,
  quantite numeric,
  unite text,
  temps_prevu_h numeric,
  temps_reel_h numeric,
  duration_days integer,
  order_index integer,
  intervenant_id uuid,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_intervenant_id uuid;
begin
  v_intervenant_id := public._intervenant_assert_chantier_access(p_token, p_chantier_id);

  return query
  select
    t.id,
    t.chantier_id,
    t.titre,
    t.status,
    t.lot,
    t.corps_etat,
    t.date,
    t.date_debut,
    t.date_fin,
    t.quantite,
    t.unite,
    t.temps_prevu_h,
    t.temps_reel_h,
    greatest(coalesce(t.duration_days, 1), 1)::integer as duration_days,
    greatest(coalesce(t.order_index, 0), 0)::integer as order_index,
    t.intervenant_id,
    t.updated_at
  from public.chantier_tasks t
  where t.chantier_id = p_chantier_id
    and (
      v_intervenant_id is null
      or t.intervenant_id = v_intervenant_id
      or exists (
        select 1
        from public.chantier_task_assignees cta
        where cta.task_id = t.id
          and cta.intervenant_id = v_intervenant_id
      )
    )
  order by coalesce(t.order_index, 0), coalesce(t.created_at, now()), t.titre;
end;
$$;

drop function if exists public.intervenant_update_task_status(text, uuid, text);
create or replace function public.intervenant_update_task_status(
  p_token text,
  p_task_id uuid,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_task record;
  v_intervenant_id uuid;
  v_status text;
begin
  if p_task_id is null then
    raise exception 'task_id_required';
  end if;

  select t.id, t.chantier_id
  into v_task
  from public.chantier_tasks t
  where t.id = p_task_id
  limit 1;

  if not found then
    raise exception 'task_not_found';
  end if;

  v_intervenant_id := public._intervenant_assert_chantier_access(p_token, v_task.chantier_id);

  if v_intervenant_id is not null
     and not exists (
       select 1
       from public.chantier_tasks t
       where t.id = p_task_id
         and (
           t.intervenant_id = v_intervenant_id
           or exists (
             select 1
             from public.chantier_task_assignees cta
             where cta.task_id = t.id
               and cta.intervenant_id = v_intervenant_id
           )
         )
     ) then
    raise exception 'forbidden_task_scope';
  end if;

  v_status := upper(replace(coalesce(nullif(btrim(p_status), ''), 'A_FAIRE'), ' ', '_'));
  if v_status not in ('A_FAIRE', 'EN_COURS', 'FAIT', 'TERMINE', 'DONE', 'COMPLETED') then
    raise exception 'invalid_task_status';
  end if;

  if v_status in ('TERMINE', 'DONE', 'COMPLETED') then
    v_status := 'FAIT';
  end if;

  update public.chantier_tasks t
  set
    status = v_status,
    updated_at = now()
  where t.id = p_task_id
  returning jsonb_build_object(
    'id', t.id,
    'chantier_id', t.chantier_id,
    'status', t.status,
    'updated_at', t.updated_at
  )
  into v_task;

  return coalesce(v_task, '{}'::jsonb);
end;
$$;

drop function if exists public.intervenant_add_task_comment(text, uuid, text, jsonb);
create or replace function public.intervenant_add_task_comment(
  p_token text,
  p_task_id uuid,
  p_message text,
  p_photos jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_task record;
  v_intervenant_id uuid;
  v_comment_id uuid;
begin
  if p_task_id is null then
    raise exception 'task_id_required';
  end if;

  if nullif(btrim(coalesce(p_message, '')), '') is null then
    raise exception 'message_required';
  end if;

  select t.id, t.chantier_id
  into v_task
  from public.chantier_tasks t
  where t.id = p_task_id
  limit 1;

  if not found then
    raise exception 'task_not_found';
  end if;

  v_intervenant_id := public._intervenant_assert_chantier_access(p_token, v_task.chantier_id);

  if v_intervenant_id is not null
     and not exists (
       select 1
       from public.chantier_tasks t
       where t.id = p_task_id
         and (
           t.intervenant_id = v_intervenant_id
           or exists (
             select 1
             from public.chantier_task_assignees cta
             where cta.task_id = t.id
               and cta.intervenant_id = v_intervenant_id
           )
         )
     ) then
    raise exception 'forbidden_task_scope';
  end if;

  insert into public.chantier_task_comments (
    task_id,
    chantier_id,
    intervenant_id,
    message,
    photos
  ) values (
    v_task.id,
    v_task.chantier_id,
    v_intervenant_id,
    btrim(p_message),
    coalesce(p_photos, '[]'::jsonb)
  )
  returning id into v_comment_id;

  return jsonb_build_object(
    'id', v_comment_id,
    'task_id', v_task.id,
    'chantier_id', v_task.chantier_id,
    'intervenant_id', v_intervenant_id,
    'message', btrim(p_message),
    'photos', coalesce(p_photos, '[]'::jsonb)
  );
end;
$$;

drop function if exists public.intervenant_get_documents(text, uuid);
create or replace function public.intervenant_get_documents(p_token text, p_chantier_id uuid)
returns table (
  id uuid,
  chantier_id uuid,
  title text,
  file_name text,
  category text,
  document_type text,
  visibility_mode text,
  visibility text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_intervenant_id uuid;
begin
  v_intervenant_id := public._intervenant_assert_chantier_access(p_token, p_chantier_id);

  return query
  select
    d.id,
    d.chantier_id,
    d.title,
    d.file_name,
    d.category,
    d.document_type,
    d.visibility_mode,
    d.visibility,
    d.created_at
  from public.chantier_documents d
  where d.chantier_id = p_chantier_id
    and coalesce(upper(d.visibility), 'INTERVENANT') <> 'ADMIN'
    and (
      coalesce(upper(d.visibility_mode), 'GLOBAL') = 'GLOBAL'
      or (
        coalesce(upper(d.visibility_mode), '') = 'RESTRICTED'
        and v_intervenant_id is not null
        and (
          (d.allowed_intervenant_ids is not null and v_intervenant_id = any(d.allowed_intervenant_ids))
          or exists (
            select 1
            from public.document_access da
            where da.document_id = d.id
              and da.intervenant_id = v_intervenant_id
          )
        )
      )
    )
  order by d.created_at desc;
end;
$$;

drop function if exists public.intervenant_get_planning(text, uuid);
create or replace function public.intervenant_get_planning(p_token text, p_chantier_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_intervenant_id uuid;
  v_has_lot_planning boolean;
  v_has_lot_column boolean;
  v_lots jsonb := '[]'::jsonb;
begin
  v_intervenant_id := public._intervenant_assert_chantier_access(p_token, p_chantier_id);
  v_has_lot_planning := to_regclass('public.chantier_lot_planning') is not null;

  if v_has_lot_planning then
    select exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'chantier_lot_planning'
        and column_name = 'lot'
    ) into v_has_lot_column;

    if v_has_lot_column then
      with chantier_scope as (
        select
          c.id,
          c.planning_start_date,
          c.planning_end_date,
          c.date_debut,
          c.date_fin_prevue
        from public.chantiers c
        where c.id = p_chantier_id
      ),
      task_summary as (
        select
          trim(coalesce(nullif(t.lot, ''), nullif(t.corps_etat, ''), 'A classer')) as lot,
          min(t.date_debut) as task_start,
          max(t.date_fin) as task_end,
          sum(greatest(coalesce(t.duration_days, 1), 1))::integer as total_duration_days,
          count(*)::integer as total_tasks,
          count(*) filter (where upper(coalesce(t.status, '')) in ('FAIT', 'TERMINE', 'DONE', 'COMPLETED'))::integer as done_tasks
        from public.chantier_tasks t
        where t.chantier_id = p_chantier_id
          and (
            v_intervenant_id is null
            or t.intervenant_id = v_intervenant_id
            or exists (
              select 1
              from public.chantier_task_assignees cta
              where cta.task_id = t.id
                and cta.intervenant_id = v_intervenant_id
            )
          )
        group by 1
      )
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'lot', lp.lot,
            'start_date', coalesce(lp.start_date, ts.task_start, cs.planning_start_date, cs.date_debut),
            'end_date',
              coalesce(
                lp.end_date,
                ts.task_end,
                cs.planning_end_date,
                cs.date_fin_prevue,
                case
                  when coalesce(lp.start_date, ts.task_start, cs.planning_start_date, cs.date_debut) is not null
                    then (coalesce(lp.start_date, ts.task_start, cs.planning_start_date, cs.date_debut)
                          + greatest(coalesce(ts.total_duration_days, 1) - 1, 0))
                  else null
                end
              ),
            'order_index', lp.order_index,
            'total_duration_days', coalesce(ts.total_duration_days, 0),
            'total_tasks', coalesce(ts.total_tasks, 0),
            'done_tasks', coalesce(ts.done_tasks, 0),
            'progress_pct',
              case
                when coalesce(ts.total_tasks, 0) = 0 then 0
                else round((ts.done_tasks::numeric * 100.0) / ts.total_tasks, 1)
              end
          )
          order by lp.order_index, lp.lot
        ),
        '[]'::jsonb
      )
      into v_lots
      from public.chantier_lot_planning lp
      left join task_summary ts
        on ts.lot = lp.lot
      cross join chantier_scope cs
      where lp.chantier_id = p_chantier_id;
    else
      with task_summary as (
        select
          trim(coalesce(nullif(t.lot, ''), nullif(t.corps_etat, ''), 'A classer')) as lot,
          min(t.date_debut) as task_start,
          max(t.date_fin) as task_end,
          sum(greatest(coalesce(t.duration_days, 1), 1))::integer as total_duration_days,
          count(*)::integer as total_tasks,
          count(*) filter (where upper(coalesce(t.status, '')) in ('FAIT', 'TERMINE', 'DONE', 'COMPLETED'))::integer as done_tasks
        from public.chantier_tasks t
        where t.chantier_id = p_chantier_id
          and (
            v_intervenant_id is null
            or t.intervenant_id = v_intervenant_id
            or exists (
              select 1
              from public.chantier_task_assignees cta
              where cta.task_id = t.id
                and cta.intervenant_id = v_intervenant_id
            )
          )
        group by 1
      )
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'lot', ts.lot,
            'start_date', ts.task_start,
            'end_date', coalesce(ts.task_end, case when ts.task_start is not null then ts.task_start + greatest(ts.total_duration_days - 1, 0) else null end),
            'order_index', 0,
            'total_duration_days', ts.total_duration_days,
            'total_tasks', ts.total_tasks,
            'done_tasks', ts.done_tasks,
            'progress_pct',
              case
                when ts.total_tasks = 0 then 0
                else round((ts.done_tasks::numeric * 100.0) / ts.total_tasks, 1)
              end
          )
          order by ts.lot
        ),
        '[]'::jsonb
      )
      into v_lots
      from task_summary ts;
    end if;
  end if;

  if coalesce(jsonb_array_length(v_lots), 0) = 0 then
    with task_summary as (
      select
        trim(coalesce(nullif(t.lot, ''), nullif(t.corps_etat, ''), 'A classer')) as lot,
        min(t.date_debut) as task_start,
        max(t.date_fin) as task_end,
        sum(greatest(coalesce(t.duration_days, 1), 1))::integer as total_duration_days,
        count(*)::integer as total_tasks,
        count(*) filter (where upper(coalesce(t.status, '')) in ('FAIT', 'TERMINE', 'DONE', 'COMPLETED'))::integer as done_tasks,
        min(coalesce(t.order_index, 0))::integer as order_index
      from public.chantier_tasks t
      where t.chantier_id = p_chantier_id
        and (
          v_intervenant_id is null
          or t.intervenant_id = v_intervenant_id
          or exists (
            select 1
            from public.chantier_task_assignees cta
            where cta.task_id = t.id
              and cta.intervenant_id = v_intervenant_id
          )
        )
      group by 1
    )
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'lot', ts.lot,
          'start_date', ts.task_start,
          'end_date', coalesce(ts.task_end, case when ts.task_start is not null then ts.task_start + greatest(ts.total_duration_days - 1, 0) else null end),
          'order_index', ts.order_index,
          'total_duration_days', ts.total_duration_days,
          'total_tasks', ts.total_tasks,
          'done_tasks', ts.done_tasks,
          'progress_pct', case when ts.total_tasks = 0 then 0 else round((ts.done_tasks::numeric * 100.0) / ts.total_tasks, 1) end
        )
        order by ts.order_index, ts.lot
      ),
      '[]'::jsonb
    )
    into v_lots
    from task_summary ts;
  end if;

  return jsonb_build_object(
    'chantier_id', p_chantier_id,
    'lots', coalesce(v_lots, '[]'::jsonb)
  );
end;
$$;

drop function if exists public.intervenant_get_planning(text);
create or replace function public.intervenant_get_planning(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_session jsonb;
  v_chantier_id uuid;
begin
  v_session := public.intervenant_session(p_token);
  v_chantier_id := nullif(v_session ->> 'default_chantier_id', '')::uuid;

  if v_chantier_id is null then
    raise exception 'chantier_id_required';
  end if;

  return public.intervenant_get_planning(p_token, v_chantier_id);
end;
$$;

drop function if exists public.intervenant_time_create(text, jsonb);
create or replace function public.intervenant_time_create(
  p_token text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_chantier_id uuid;
  v_task_id uuid;
  v_intervenant_id uuid;
  v_hours numeric;
  v_work_date date;
  v_note text;
  v_id uuid;
begin
  v_chantier_id := nullif(btrim(coalesce(p_payload ->> 'chantier_id', '')), '')::uuid;
  v_task_id := nullif(btrim(coalesce(p_payload ->> 'task_id', '')), '')::uuid;
  v_hours := nullif(btrim(coalesce(p_payload ->> 'duration_hours', p_payload ->> 'hours')), '')::numeric;
  v_work_date := coalesce(
    nullif(btrim(coalesce(p_payload ->> 'work_date', '')), '')::date,
    current_date
  );
  v_note := nullif(btrim(coalesce(p_payload ->> 'note', '')), '');

  if v_chantier_id is null then
    raise exception 'chantier_id_required';
  end if;

  if v_hours is null or v_hours <= 0 then
    raise exception 'invalid_duration_hours';
  end if;

  v_intervenant_id := public._intervenant_assert_chantier_access(p_token, v_chantier_id);
  if v_intervenant_id is null then
    raise exception 'intervenant_required';
  end if;

  if v_task_id is not null then
    if not exists (
      select 1
      from public.chantier_tasks t
      where t.id = v_task_id
        and t.chantier_id = v_chantier_id
        and (
          t.intervenant_id = v_intervenant_id
          or exists (
            select 1
            from public.chantier_task_assignees cta
            where cta.task_id = t.id
              and cta.intervenant_id = v_intervenant_id
          )
        )
    ) then
      raise exception 'forbidden_task_scope';
    end if;
  end if;

  insert into public.chantier_time_entries (
    chantier_id,
    task_id,
    intervenant_id,
    work_date,
    duration_hours,
    note
  ) values (
    v_chantier_id,
    v_task_id,
    v_intervenant_id,
    v_work_date,
    v_hours,
    v_note
  )
  returning id into v_id;

  return jsonb_build_object(
    'id', v_id,
    'chantier_id', v_chantier_id,
    'task_id', v_task_id,
    'intervenant_id', v_intervenant_id,
    'work_date', v_work_date,
    'duration_hours', v_hours,
    'note', v_note
  );
end;
$$;

drop function if exists public.intervenant_time_list(text, uuid);
create or replace function public.intervenant_time_list(
  p_token text,
  p_chantier_id uuid
)
returns table (
  id uuid,
  chantier_id uuid,
  task_id uuid,
  task_titre text,
  intervenant_id uuid,
  work_date date,
  duration_hours numeric,
  note text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_intervenant_id uuid;
begin
  v_intervenant_id := public._intervenant_assert_chantier_access(p_token, p_chantier_id);
  if v_intervenant_id is null then
    raise exception 'intervenant_required';
  end if;

  return query
  select
    te.id,
    te.chantier_id,
    te.task_id,
    t.titre as task_titre,
    te.intervenant_id,
    te.work_date,
    te.duration_hours,
    te.note,
    te.created_at
  from public.chantier_time_entries te
  left join public.chantier_tasks t
    on t.id = te.task_id
  where te.chantier_id = p_chantier_id
    and te.intervenant_id = v_intervenant_id
  order by te.work_date desc, te.created_at desc;
end;
$$;

drop function if exists public.intervenant_materiel_create(text, jsonb);
create or replace function public.intervenant_materiel_create(
  p_token text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_chantier_id uuid;
  v_intervenant_id uuid;
  v_titre text;
  v_quantite numeric;
  v_unite text;
  v_commentaire text;
  v_date_souhaitee date;
  v_id uuid;
begin
  v_chantier_id := nullif(btrim(coalesce(p_payload ->> 'chantier_id', '')), '')::uuid;
  if v_chantier_id is null then
    raise exception 'chantier_id_required';
  end if;

  v_intervenant_id := public._intervenant_assert_chantier_access(p_token, v_chantier_id);
  if v_intervenant_id is null then
    raise exception 'intervenant_required';
  end if;

  v_titre := nullif(btrim(coalesce(p_payload ->> 'titre', p_payload ->> 'title')), '');
  if v_titre is null then
    raise exception 'titre_required';
  end if;

  v_quantite := nullif(btrim(coalesce(p_payload ->> 'quantite', '')), '')::numeric;
  v_unite := nullif(btrim(coalesce(p_payload ->> 'unite', '')), '');
  v_commentaire := nullif(btrim(coalesce(p_payload ->> 'commentaire', p_payload ->> 'comment')), '');
  v_date_souhaitee := nullif(btrim(coalesce(p_payload ->> 'date_souhaitee', '')), '')::date;

  insert into public.materiel_demandes (
    chantier_id,
    intervenant_id,
    titre,
    designation,
    quantite,
    unite,
    commentaire,
    remarques,
    date_souhaitee,
    date_besoin,
    statut,
    status
  ) values (
    v_chantier_id,
    v_intervenant_id,
    v_titre,
    v_titre,
    coalesce(v_quantite, 1),
    v_unite,
    v_commentaire,
    v_commentaire,
    v_date_souhaitee,
    v_date_souhaitee,
    'en_attente',
    'A_COMMANDER'
  )
  returning id into v_id;

  return jsonb_build_object(
    'id', v_id,
    'chantier_id', v_chantier_id,
    'intervenant_id', v_intervenant_id,
    'titre', v_titre,
    'quantite', coalesce(v_quantite, 1),
    'unite', v_unite,
    'commentaire', v_commentaire,
    'date_souhaitee', v_date_souhaitee,
    'statut', 'en_attente'
  );
end;
$$;

drop function if exists public.intervenant_materiel_list(text, uuid);
create or replace function public.intervenant_materiel_list(
  p_token text,
  p_chantier_id uuid
)
returns table (
  id uuid,
  chantier_id uuid,
  intervenant_id uuid,
  titre text,
  quantite numeric,
  unite text,
  commentaire text,
  date_souhaitee date,
  statut text,
  admin_commentaire text,
  validated_at timestamptz,
  validated_by uuid,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_intervenant_id uuid;
begin
  v_intervenant_id := public._intervenant_assert_chantier_access(p_token, p_chantier_id);

  return query
  select
    md.id,
    md.chantier_id,
    md.intervenant_id,
    coalesce(nullif(btrim(md.titre), ''), nullif(btrim(md.designation), ''), 'Demande materiel') as titre,
    md.quantite,
    md.unite,
    coalesce(md.commentaire, md.remarques) as commentaire,
    coalesce(md.date_souhaitee, md.date_besoin, md.date_livraison) as date_souhaitee,
    public._materiel_normalize_statut(md.statut, md.status) as statut,
    md.admin_commentaire,
    md.validated_at,
    md.validated_by,
    md.created_at,
    md.updated_at
  from public.materiel_demandes md
  where md.chantier_id = p_chantier_id
    and (v_intervenant_id is null or md.intervenant_id = v_intervenant_id)
  order by md.created_at desc;
end;
$$;

drop function if exists public.admin_materiel_list(uuid);
create or replace function public.admin_materiel_list(p_chantier_id uuid)
returns table (
  id uuid,
  chantier_id uuid,
  intervenant_id uuid,
  intervenant_nom text,
  titre text,
  quantite numeric,
  unite text,
  commentaire text,
  date_souhaitee date,
  statut text,
  admin_commentaire text,
  validated_at timestamptz,
  validated_by uuid,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public._assert_admin_authenticated();

  if p_chantier_id is null then
    raise exception 'chantier_id_required';
  end if;

  return query
  select
    md.id,
    md.chantier_id,
    md.intervenant_id,
    i.nom as intervenant_nom,
    coalesce(nullif(btrim(md.titre), ''), nullif(btrim(md.designation), ''), 'Demande materiel') as titre,
    md.quantite,
    md.unite,
    coalesce(md.commentaire, md.remarques) as commentaire,
    coalesce(md.date_souhaitee, md.date_besoin, md.date_livraison) as date_souhaitee,
    public._materiel_normalize_statut(md.statut, md.status) as statut,
    md.admin_commentaire,
    md.validated_at,
    md.validated_by,
    md.created_at,
    md.updated_at
  from public.materiel_demandes md
  left join public.intervenants i
    on i.id = md.intervenant_id
  where md.chantier_id = p_chantier_id
  order by md.created_at desc;
end;
$$;

drop function if exists public.admin_materiel_update_status(uuid, text, text);
create or replace function public.admin_materiel_update_status(
  p_id uuid,
  p_statut text,
  p_admin_commentaire text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_statut text;
  v_row jsonb;
begin
  perform public._assert_admin_authenticated();

  if p_id is null then
    raise exception 'materiel_id_required';
  end if;

  v_statut := public._materiel_normalize_statut(p_statut, null);
  if v_statut not in ('en_attente', 'validee', 'refusee', 'livree') then
    raise exception 'invalid_materiel_status';
  end if;

  update public.materiel_demandes md
  set
    statut = v_statut,
    status = public._materiel_legacy_status_from_statut(v_statut),
    admin_commentaire = nullif(btrim(coalesce(p_admin_commentaire, '')), ''),
    validated_at = case when v_statut in ('validee', 'refusee', 'livree') then now() else null end,
    validated_by = case when v_statut in ('validee', 'refusee', 'livree') then auth.uid() else null end,
    updated_at = now()
  where md.id = p_id
  returning jsonb_build_object(
    'id', md.id,
    'chantier_id', md.chantier_id,
    'intervenant_id', md.intervenant_id,
    'titre', coalesce(nullif(btrim(md.titre), ''), nullif(btrim(md.designation), ''), 'Demande materiel'),
    'quantite', md.quantite,
    'unite', md.unite,
    'commentaire', coalesce(md.commentaire, md.remarques),
    'date_souhaitee', coalesce(md.date_souhaitee, md.date_besoin, md.date_livraison),
    'statut', md.statut,
    'admin_commentaire', md.admin_commentaire,
    'validated_at', md.validated_at,
    'validated_by', md.validated_by,
    'updated_at', md.updated_at
  )
  into v_row;

  if v_row is null then
    raise exception 'materiel_not_found';
  end if;

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7) grants
-- ---------------------------------------------------------------------------
revoke all on function public.admin_create_intervenant_link(uuid, uuid, timestamptz) from public;
revoke all on function public.admin_create_intervenant_link(uuid, timestamptz) from public;
revoke all on function public.admin_set_intervenant_link_chantiers(uuid, uuid[], timestamptz, text) from public;
revoke all on function public.admin_remove_intervenant_link_chantiers(text, uuid[]) from public;
revoke all on function public.admin_revoke_intervenant_link(text) from public;
revoke all on function public.intervenant_session(text) from public;
revoke all on function public.intervenant_get_chantiers(text) from public;
revoke all on function public.intervenant_get_tasks(text, uuid) from public;
revoke all on function public.intervenant_update_task_status(text, uuid, text) from public;
revoke all on function public.intervenant_add_task_comment(text, uuid, text, jsonb) from public;
revoke all on function public.intervenant_get_documents(text, uuid) from public;
revoke all on function public.intervenant_get_planning(text, uuid) from public;
revoke all on function public.intervenant_get_planning(text) from public;
revoke all on function public.intervenant_time_create(text, jsonb) from public;
revoke all on function public.intervenant_time_list(text, uuid) from public;
revoke all on function public.intervenant_materiel_create(text, jsonb) from public;
revoke all on function public.intervenant_materiel_list(text, uuid) from public;
revoke all on function public.admin_materiel_list(uuid) from public;
revoke all on function public.admin_materiel_update_status(uuid, text, text) from public;

grant execute on function public.admin_create_intervenant_link(uuid, uuid, timestamptz) to authenticated;
grant execute on function public.admin_create_intervenant_link(uuid, timestamptz) to authenticated;
grant execute on function public.admin_set_intervenant_link_chantiers(uuid, uuid[], timestamptz, text) to authenticated;
grant execute on function public.admin_remove_intervenant_link_chantiers(text, uuid[]) to authenticated;
grant execute on function public.admin_revoke_intervenant_link(text) to authenticated;
grant execute on function public.intervenant_session(text) to anon, authenticated;
grant execute on function public.intervenant_get_chantiers(text) to anon, authenticated;
grant execute on function public.intervenant_get_tasks(text, uuid) to anon, authenticated;
grant execute on function public.intervenant_update_task_status(text, uuid, text) to anon, authenticated;
grant execute on function public.intervenant_add_task_comment(text, uuid, text, jsonb) to anon, authenticated;
grant execute on function public.intervenant_get_documents(text, uuid) to anon, authenticated;
grant execute on function public.intervenant_get_planning(text, uuid) to anon, authenticated;
grant execute on function public.intervenant_get_planning(text) to anon, authenticated;
grant execute on function public.intervenant_time_create(text, jsonb) to anon, authenticated;
grant execute on function public.intervenant_time_list(text, uuid) to anon, authenticated;
grant execute on function public.intervenant_materiel_create(text, jsonb) to anon, authenticated;
grant execute on function public.intervenant_materiel_list(text, uuid) to anon, authenticated;
grant execute on function public.admin_materiel_list(uuid) to authenticated;
grant execute on function public.admin_materiel_update_status(uuid, text, text) to authenticated;

grant select, insert, update on table public.chantier_task_comments to authenticated;
grant select, insert, update on table public.chantier_time_entries to authenticated;
grant select, insert, update on table public.materiel_demandes to authenticated;

do $$
declare
  v_idx record;
begin
  if to_regclass('public.chantier_access') is null then
    return;
  end if;

  for v_idx in
    select
      i.indexname
    from pg_indexes i
    where i.schemaname = 'public'
      and i.tablename = 'chantier_access'
      and i.indexdef ilike 'create unique index%'
      and i.indexdef ilike '%(token)%'
      and i.indexdef not ilike '%(token, chantier_id)%'
      and i.indexname <> 'chantier_access_token_chantier_uniq'
  loop
    execute format('drop index if exists public.%I', v_idx.indexname);
  end loop;
end $$;

create index if not exists chantier_access_token_idx
  on public.chantier_access(token);

create index if not exists chantier_access_token_chantier_idx
  on public.chantier_access(token, chantier_id);

create unique index if not exists chantier_access_token_chantier_uniq
  on public.chantier_access(token, chantier_id);

create index if not exists chantier_access_active_token_idx
  on public.chantier_access(token)
  where revoked_at is null;

create index if not exists chantier_access_intervenant_active_idx
  on public.chantier_access(intervenant_id, chantier_id)
  where revoked_at is null;

alter table if exists public.chantier_access enable row level security;

drop policy if exists chantier_access_admin_select on public.chantier_access;
drop policy if exists chantier_access_admin_insert on public.chantier_access;
drop policy if exists chantier_access_admin_update on public.chantier_access;
drop policy if exists chantier_access_admin_delete on public.chantier_access;
drop policy if exists chantier_access_admin_all on public.chantier_access;

create policy chantier_access_admin_select
  on public.chantier_access
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'ADMIN'
    )
  );

create policy chantier_access_admin_insert
  on public.chantier_access
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'ADMIN'
    )
  );

create policy chantier_access_admin_update
  on public.chantier_access
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'ADMIN'
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'ADMIN'
    )
  );

create policy chantier_access_admin_delete
  on public.chantier_access
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'ADMIN'
    )
  );

-- ---------------------------------------------------------------------------
-- 2) matériel: align schema with portal MVP statuses
-- ---------------------------------------------------------------------------
alter table if exists public.materiel_demandes
  add column if not exists titre text,
  add column if not exists commentaire text,
  add column if not exists date_souhaitee date,
  add column if not exists admin_commentaire text,
  add column if not exists validated_at timestamptz,
  add column if not exists validated_by uuid;

do $$
begin
  if to_regclass('public.materiel_demandes') is not null
     and not exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'materiel_demandes'
         and column_name = 'statut'
     ) then
    alter table public.materiel_demandes
      add column statut text;
  end if;
end $$;

do $$
begin
  if to_regclass('public.materiel_demandes') is not null
     and not exists (
       select 1
       from pg_constraint
       where conrelid = 'public.materiel_demandes'::regclass
         and conname = 'materiel_demandes_validated_by_fkey'
     ) then
    alter table public.materiel_demandes
      add constraint materiel_demandes_validated_by_fkey
      foreign key (validated_by)
      references auth.users(id)
      on delete set null;
  end if;
end $$;

drop function if exists public._materiel_normalize_statut(text, text);
create or replace function public._materiel_normalize_statut(p_statut text, p_status text default null)
returns text
language sql
immutable
as $$
  select case upper(coalesce(nullif(btrim(p_statut), ''), nullif(btrim(p_status), ''), 'EN_ATTENTE'))
    when 'EN_ATTENTE' then 'en_attente'
    when 'EN ATTENTE' then 'en_attente'
    when 'A_COMMANDER' then 'en_attente'
    when 'A COMMANDER' then 'en_attente'
    when 'ENVOYE' then 'en_attente'
    when 'A_FAIRE' then 'en_attente'
    when 'VALIDE' then 'validee'
    when 'VALIDEE' then 'validee'
    when 'COMMANDE' then 'validee'
    when 'REFUSE' then 'refusee'
    when 'REFUSEE' then 'refusee'
    when 'LIVRE' then 'livree'
    when 'LIVREE' then 'livree'
    else 'en_attente'
  end;
$$;

drop function if exists public._materiel_legacy_status_from_statut(text);
create or replace function public._materiel_legacy_status_from_statut(p_statut text)
returns text
language sql
immutable
as $$
  select case public._materiel_normalize_statut(p_statut, null)
    when 'en_attente' then 'A_COMMANDER'
    when 'validee' then 'COMMANDE'
    when 'refusee' then 'REFUSEE'
    when 'livree' then 'LIVRE'
    else 'A_COMMANDER'
  end;
$$;

update public.materiel_demandes
set
  titre = coalesce(nullif(btrim(titre), ''), nullif(btrim(designation), ''), 'Demande materiel'),
  commentaire = coalesce(commentaire, remarques),
  date_souhaitee = coalesce(date_souhaitee, date_besoin, date_livraison),
  statut = public._materiel_normalize_statut(statut, status),
  status = public._materiel_legacy_status_from_statut(public._materiel_normalize_statut(statut, status));

update public.materiel_demandes
set statut = 'en_attente'
where statut is null or btrim(statut) = '';

alter table if exists public.materiel_demandes
  alter column statut set default 'en_attente';

alter table if exists public.materiel_demandes
  alter column statut set not null;

do $$
begin
  if to_regclass('public.materiel_demandes') is not null
     and exists (
       select 1
       from pg_constraint
       where conrelid = 'public.materiel_demandes'::regclass
         and conname = 'materiel_demandes_status_check'
     ) then
    alter table public.materiel_demandes
      drop constraint materiel_demandes_status_check;
  end if;
end $$;

do $$
begin
  if to_regclass('public.materiel_demandes') is not null
     and not exists (
       select 1
       from pg_constraint
       where conrelid = 'public.materiel_demandes'::regclass
         and conname = 'materiel_demandes_status_check'
     ) then
    alter table public.materiel_demandes
      add constraint materiel_demandes_status_check check (
        status is null
        or upper(status) = any (array['A_COMMANDER', 'ENVOYE', 'COMMANDE', 'LIVRE', 'REFUSEE'])
      );
  end if;
end $$;

do $$
begin
  if to_regclass('public.materiel_demandes') is not null
     and not exists (
       select 1
       from pg_constraint
       where conrelid = 'public.materiel_demandes'::regclass
         and conname = 'materiel_demandes_statut_v2_chk'
     ) then
    alter table public.materiel_demandes
      add constraint materiel_demandes_statut_v2_chk check (
        statut in ('en_attente', 'validee', 'refusee', 'livree')
      );
  end if;
end $$;

create index if not exists materiel_demandes_chantier_intervenant_statut_idx
  on public.materiel_demandes(chantier_id, intervenant_id, statut);

create index if not exists materiel_demandes_chantier_statut_idx
  on public.materiel_demandes(chantier_id, statut);

do $$
begin
  if to_regclass('public.materiel_demandes') is not null
     and exists (
       select 1
       from pg_proc
       where proname = 'set_updated_at'
     ) then
    drop trigger if exists trg_materiel_demandes_updated_at on public.materiel_demandes;
    create trigger trg_materiel_demandes_updated_at
    before update on public.materiel_demandes
    for each row execute function public.set_updated_at();
  end if;
end $$;
