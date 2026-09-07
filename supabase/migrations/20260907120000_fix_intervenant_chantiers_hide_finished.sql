-- The intervenant/terrain portal chantier list was governed only by whether the
-- intervenant still had a live chantier_access grant, never by the chantier's own
-- lifecycle status. Marking a chantier TERMINE/ARCHIVE/ANNULE on the admin side never
-- removed it from an intervenant's portal list. Exclude finished/archived/cancelled
-- and soft-deleted chantiers from both read paths.

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
    and c.deleted_at is null
    and c.status not in ('TERMINE', 'ARCHIVE', 'ANNULE')
  order by c.nom;
end;
$$;

revoke all on function public.intervenant_get_chantiers(text) from public;
grant execute on function public.intervenant_get_chantiers(text) to anon, authenticated;

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
  where c.id = any(coalesce(v_ctx.chantier_ids, '{}'::uuid[]))
    and c.deleted_at is null
    and c.status not in ('TERMINE', 'ARCHIVE', 'ANNULE');

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

revoke all on function public.intervenant_session(text) from public;
grant execute on function public.intervenant_session(text) to anon, authenticated;

commit;
