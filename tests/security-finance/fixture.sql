create role anon;
create role authenticated;
create table public.chantier_time_entries (
  task_id uuid,
  duration_hours numeric
);
alter table public.chantier_time_entries enable row level security;
create policy "no_external_time_access" on public.chantier_time_entries
  for select to authenticated using (false);
grant usage on schema public to authenticated, anon;
grant select on public.chantier_time_entries to authenticated;
insert into public.chantier_time_entries(task_id,duration_hours)
 values ('00000000-0000-0000-0000-000000000001',7);
create view public.chantier_task_time_totals as
 select task_id, coalesce(sum(duration_hours),0) as total_hours
 from public.chantier_time_entries
 where task_id is not null group by task_id;
grant all on public.chantier_task_time_totals to authenticated, anon;
