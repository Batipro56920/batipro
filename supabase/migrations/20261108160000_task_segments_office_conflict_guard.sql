-- Guard task-planning writes against existing office assignments.
-- Complements 20261108150000_office_planning_cross_chantier_guard.sql.
-- Deliberately leaves same-chantier planning untouched.
-- Both paths use the same organization advisory lock to serialize concurrent
-- office/task writes. No production data is changed by this file until deployed.

create or replace function public.guard_task_segment_office_conflict()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_start date;
  v_end date;
begin
  if new.intervenant_id is null
     or lower(coalesce(new.status, 'planifie')) in
        ('annule', 'annulé', 'cancelled', 'canceled', 'termine', 'terminé') then
    return new;
  end if;

  v_org := public.chantier_organization_id(new.chantier_id);
  if v_org is null then
    raise exception 'invalid_chantier';
  end if;

  -- Same lock key as office_planning_save, preventing racing writes
  -- from each endpoint from silently creating a cross-site collision.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(v_org::text));

  v_start := coalesce(new.start_date, (new.start_at at time zone 'UTC')::date);
  v_end := coalesce(
    case
      when new.start_date is not null and new.duration_days is not null
        then new.start_date + greatest(ceil(new.duration_days)::integer, 1) - 1
    end,
    (new.end_at at time zone 'UTC')::date,
    v_start + greatest(ceil(coalesce(new.duration_days, 1))::integer, 1) - 1
  );

  if v_start is null or v_end is null then
    return new; -- Unscheduled records do not book a date.
  end if;

  if exists (
    select 1
    from public.office_planning_assignments a
    where a.organization_id = v_org
      and a.intervenant_id = new.intervenant_id
      and a.chantier_id <> new.chantier_id
      and a.date_start <= v_end
      and a.date_end >= v_start
  ) then
    raise exception 'worker_office_on_other_chantier';
  end if;

  return new;
end;
$$;

-- Trigger functions do not need direct Data API execution permissions.
revoke all on function public.guard_task_segment_office_conflict() from public, anon, authenticated;

drop trigger if exists task_segment_office_conflict_guard on public.chantier_task_segments;
create trigger task_segment_office_conflict_guard
before insert or update of
  chantier_id, intervenant_id, start_date, duration_days, start_at, end_at, status
on public.chantier_task_segments
for each row execute function public.guard_task_segment_office_conflict();

drop trigger if exists task_planning_segment_office_conflict_guard on public.chantier_task_planning_segments;
create trigger task_planning_segment_office_conflict_guard
before insert or update of
  chantier_id, intervenant_id, start_date, duration_days, start_at, end_at, status
on public.chantier_task_planning_segments
for each row execute function public.guard_task_segment_office_conflict();
