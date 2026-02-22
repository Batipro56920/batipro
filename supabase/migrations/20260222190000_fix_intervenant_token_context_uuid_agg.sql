-- Fix UUID aggregates compatibility for intervenant token context
-- PostgreSQL instance may not provide min/max(uuid) aggregates.

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
    max(ca.intervenant_id::text)::uuid as intervenant_id,
    max(ca.email) as access_email,
    max(coalesce(ca.role, 'INTERVENANT')) as access_role,
    max(coalesce(ca.scope, 'INTERVENANT_PORTAL')) as scope,
    min(ca.expires_at) as expires_at,
    array_agg(distinct ca.chantier_id) as chantier_ids,
    min(ca.chantier_id::text)::uuid as default_chantier_id
  from public.chantier_access ca
  where ca.token = v_token
    and ca.revoked_at is null
    and ca.expires_at > now()
  group by ca.token;
end;
$$;

revoke all on function public._intervenant_token_context_v2(text) from public;
