-- Fixe le cout horaire au moment du pointage, sans modifier les entrees historiques.
-- Les anciens pointages restent NULL et sont signales comme non historises.
alter table public.chantier_time_entries
  add column if not exists hourly_cost_snapshot_ht numeric(12,4),
  add column if not exists hourly_cost_snapshot_source text
    check (hourly_cost_snapshot_source in ('intervenant','journalier','chantier'));
comment on column public.chantier_time_entries.hourly_cost_snapshot_ht is
  'Cout horaire de reference figé lors du pointage; NULL pour les pointages historiques non historises.';

create or replace function public.capture_chantier_time_hourly_cost()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cost numeric;
  v_source text;
  v_hourly numeric;
  v_daily numeric;
  v_status text;
begin
  -- Un taux reste fixe si seuls la duree, la quantite ou les notes changent.
  -- Si l'intervenant ou la date change, determiner un nouveau taux de reference.
  if tg_op = 'UPDATE'
     and new.intervenant_id is not distinct from old.intervenant_id
     and new.chantier_id is not distinct from old.chantier_id
     and new.work_date is not distinct from old.work_date then
    new.hourly_cost_snapshot_ht := old.hourly_cost_snapshot_ht;
    new.hourly_cost_snapshot_source := old.hourly_cost_snapshot_source;
    return new;
  end if;

  select i.hourly_cost_ht, i.daily_rate_ht, i.status
    into v_hourly, v_daily, v_status
  from public.intervenants i
  where i.id = new.intervenant_id;

  if v_hourly > 0 then
    v_cost := v_hourly;
    v_source := 'intervenant';
  elsif v_status in ('subcontractor','temporary_worker') and v_daily > 0 then
    v_cost := v_daily / 7;
    v_source := 'journalier';
  else
    select b.taux_horaire_mo_ht into v_cost
    from public.chantier_budget_settings b
    where b.chantier_id = new.chantier_id;
    v_cost := coalesce(v_cost, 48);
    v_source := 'chantier';
  end if;
  new.hourly_cost_snapshot_ht := v_cost;
  new.hourly_cost_snapshot_source := v_source;
  return new;
end;
$$;

revoke all on function public.capture_chantier_time_hourly_cost() from public, anon, authenticated;

drop trigger if exists chantier_time_capture_hourly_cost on public.chantier_time_entries;
create trigger chantier_time_capture_hourly_cost
before insert or update of chantier_id, intervenant_id, work_date, hourly_cost_snapshot_ht, hourly_cost_snapshot_source
on public.chantier_time_entries
for each row execute function public.capture_chantier_time_hourly_cost();
