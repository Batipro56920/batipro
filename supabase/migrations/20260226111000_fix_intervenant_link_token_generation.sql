-- Fix: admin_create_intervenant_link should not depend on gen_random_bytes()
-- because SECURITY DEFINER search_path excludes extensions schema.

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
      -- Hex token, url-safe, no pgcrypto dependency.
      v_token :=
        md5(
          random()::text
          || clock_timestamp()::text
          || txid_current()::text
          || v_try::text
          || coalesce(p_chantier_id::text, '')
        )
        || md5(
          random()::text
          || clock_timestamp()::text
          || pg_backend_pid()::text
          || coalesce(p_intervenant_id::text, '')
        );

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
