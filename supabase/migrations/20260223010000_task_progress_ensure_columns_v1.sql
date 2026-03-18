-- Ensure required task progress columns exist for automatic progress calculation.

alter table if exists public.chantier_tasks
  add column if not exists temps_prevu_h numeric,
  add column if not exists temps_reel_h numeric,
  add column if not exists progress_admin_offset_percent numeric not null default 0;

update public.chantier_tasks
set progress_admin_offset_percent = 0
where progress_admin_offset_percent is null;

do $$
begin
  if to_regclass('public.chantier_tasks') is not null
     and not exists (
       select 1
       from pg_constraint
       where conrelid = 'public.chantier_tasks'::regclass
         and conname = 'chantier_tasks_progress_admin_offset_percent_chk'
     ) then
    alter table public.chantier_tasks
      add constraint chantier_tasks_progress_admin_offset_percent_chk
      check (progress_admin_offset_percent >= -100 and progress_admin_offset_percent <= 100);
  end if;
end $$;
