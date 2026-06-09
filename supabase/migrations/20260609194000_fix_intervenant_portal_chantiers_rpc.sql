-- Fix strict return types for intervenant_get_chantiers.
-- Runtime symptom: "structure of query does not match function result type" on /intervenant.

begin;

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
  from public.chantiers c
  where c.id = any(coalesce(v_ctx.chantier_ids, '{}'::uuid[]))
  order by c.nom;
end;
$$;

revoke all on function public.intervenant_get_chantiers(text) from public;
grant execute on function public.intervenant_get_chantiers(text) to anon, authenticated;

commit;
