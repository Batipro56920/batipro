-- Add task_id + priority to chantier_reserves
alter table public.chantier_reserves
  add column if not exists task_id uuid;

alter table public.chantier_reserves
  add column if not exists priority text not null default 'NORMALE';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'chantier_reserves_task_id_fkey'
  ) then
    alter table public.chantier_reserves
      add constraint chantier_reserves_task_id_fkey
      foreign key (task_id)
      references public.chantier_tasks(id)
      on delete set null;
  end if;
end $$;

create index if not exists chantier_reserves_task_id_idx
  on public.chantier_reserves(task_id);
