-- Fix strict return types for intervenant_get_chantiers

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
    c.id::uuid,
    c.nom::text,
    c.client::text,
    c.adresse::text,
    c.status::text,
    c.avancement::numeric,
    c.date_debut::date,
    c.date_fin_prevue::date,
    c.planning_start_date::date,
    c.planning_end_date::date,
    c.created_at::timestamptz
  from public.chantier_access ca
  join public.chantiers c
    on c.id = ca.chantier_id
  where ca.token = v_ctx.token
    and ca.revoked_at is null
    and ca.expires_at > now()
  order by c.nom;
end;
$$;