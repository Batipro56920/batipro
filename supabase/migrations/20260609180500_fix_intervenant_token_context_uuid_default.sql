-- Fix portail intervenant auth session/token context when selecting a default chantier.
-- PostgreSQL does not provide min(uuid); choose a deterministic uuid with ORDER BY instead.

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
      select cid
      into v_default_chantier_id
      from unnest(coalesce(v_chantier_ids, '{}'::uuid[])) as cid
      order by cid
      limit 1;
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
  with scoped as (
    select ca.*
    from public.chantier_access ca
    where ca.token = v_token
      and ca.revoked_at is null
      and ca.expires_at > now()
  ),
  aggregated as (
    select
      (array_agg(scoped.intervenant_id::text order by scoped.created_at asc))[1]::uuid as intervenant_id,
      (array_agg(scoped.email::text order by scoped.created_at asc))[1]::text as access_email,
      (array_agg(coalesce(scoped.role, 'INTERVENANT')::text order by scoped.created_at asc))[1]::text as access_role,
      (array_agg(coalesce(scoped.scope, 'INTERVENANT_PORTAL')::text order by scoped.created_at asc))[1]::text as scope,
      min(scoped.expires_at)::timestamptz as expires_at,
      array_agg(distinct scoped.chantier_id order by scoped.chantier_id)::uuid[] as chantier_ids,
      (array_agg(distinct scoped.chantier_id order by scoped.chantier_id))[1]::uuid as default_chantier_id
    from scoped
  )
  select
    v_token::text,
    aggregated.intervenant_id,
    aggregated.access_email,
    aggregated.access_role,
    aggregated.scope,
    aggregated.expires_at,
    coalesce(aggregated.chantier_ids, '{}'::uuid[]),
    aggregated.default_chantier_id
  from aggregated;
end;
$$;

revoke all on function public._intervenant_token_context_v2(text) from public;
