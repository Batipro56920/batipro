-- Fix return types mismatch in _intervenant_token_context_v2
-- Ensure RETURN QUERY columns exactly match declared table signature.

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
  with scoped as (
    select ca.*
    from public.chantier_access ca
    where ca.token = v_token
      and ca.revoked_at is null
      and ca.expires_at > now()
  )
  select
    v_token::text as token,
    (array_agg(scoped.intervenant_id::text order by scoped.created_at asc))[1]::uuid as intervenant_id,
    (array_agg(scoped.email::text order by scoped.created_at asc))[1]::text as access_email,
    (array_agg(coalesce(scoped.role, 'INTERVENANT')::text order by scoped.created_at asc))[1]::text as access_role,
    (array_agg(coalesce(scoped.scope, 'INTERVENANT_PORTAL')::text order by scoped.created_at asc))[1]::text as scope,
    min(scoped.expires_at)::timestamptz as expires_at,
    array_agg(distinct scoped.chantier_id)::uuid[] as chantier_ids,
    min(scoped.chantier_id::text)::uuid as default_chantier_id
  from scoped;
end;
$$;

revoke all on function public._intervenant_token_context_v2(text) from public;