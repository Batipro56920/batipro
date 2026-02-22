-- Hard fix: avoid RETURN QUERY shape mismatch in _intervenant_token_context_v2
-- Use typed variables + RETURN NEXT to guarantee exact output signature.

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
  v_access_email text;
  v_access_role text;
  v_scope text;
  v_expires_at timestamptz;
  v_chantier_ids uuid[];
  v_default_chantier_id uuid;
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

  with scoped as (
    select ca.*
    from public.chantier_access ca
    where ca.token = v_token
      and ca.revoked_at is null
      and ca.expires_at > now()
  )
  select
    (array_agg(scoped.intervenant_id::text order by scoped.created_at asc))[1]::uuid,
    (array_agg(scoped.email::text order by scoped.created_at asc))[1]::text,
    (array_agg(coalesce(scoped.role, 'INTERVENANT')::text order by scoped.created_at asc))[1]::text,
    (array_agg(coalesce(scoped.scope, 'INTERVENANT_PORTAL')::text order by scoped.created_at asc))[1]::text,
    min(scoped.expires_at)::timestamptz,
    array_agg(distinct scoped.chantier_id)::uuid[],
    min(scoped.chantier_id::text)::uuid
  into
    v_intervenant_id,
    v_access_email,
    v_access_role,
    v_scope,
    v_expires_at,
    v_chantier_ids,
    v_default_chantier_id
  from scoped;

  token := v_token;
  intervenant_id := v_intervenant_id;
  access_email := v_access_email;
  access_role := v_access_role;
  scope := v_scope;
  expires_at := v_expires_at;
  chantier_ids := v_chantier_ids;
  default_chantier_id := v_default_chantier_id;

  return next;
  return;
end;
$$;

revoke all on function public._intervenant_token_context_v2(text) from public;