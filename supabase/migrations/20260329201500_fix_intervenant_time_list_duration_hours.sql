alter table public.chantier_time_entries
  add column if not exists progress_percent numeric null;

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
  task_unite text,
  intervenant_id uuid,
  work_date date,
  duration_hours numeric,
  quantite_realisee numeric,
  progress_percent numeric,
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
    coalesce(nullif(btrim(coalesce(t.titre, '')), ''), 'Tache sans titre') as task_titre,
    t.unite as task_unite,
    te.intervenant_id,
    te.work_date,
    te.duration_hours,
    te.quantite_realisee,
    te.progress_percent,
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

revoke all on function public.intervenant_time_list(text, uuid) from public;
grant execute on function public.intervenant_time_list(text, uuid) to anon, authenticated;
