do $$
begin
  if to_regclass('public.chantier_task_segments') is not null then
    alter table public.chantier_task_segments
      add column if not exists progress_percent numeric null,
      add column if not exists status text not null default 'planifie',
      add column if not exists comment text null;
  end if;
end $$;

do $$
begin
  if to_regclass('public.chantier_task_segments') is not null
     and not exists (
       select 1
       from pg_constraint
       where conrelid = 'public.chantier_task_segments'::regclass
         and conname = 'chantier_task_segments_progress_percent_chk'
     ) then
    alter table public.chantier_task_segments
      add constraint chantier_task_segments_progress_percent_chk
      check (progress_percent is null or (progress_percent >= 0 and progress_percent <= 100));
  end if;
end $$;

do $$
begin
  if to_regclass('public.chantier_task_segments') is not null
     and not exists (
       select 1
       from pg_constraint
       where conrelid = 'public.chantier_task_segments'::regclass
         and conname = 'chantier_task_segments_status_chk'
     ) then
    alter table public.chantier_task_segments
      add constraint chantier_task_segments_status_chk
      check (status in ('brouillon', 'planifie', 'en_cours', 'termine', 'annule'));
  end if;
end $$;

do $$
begin
  if to_regclass('public.chantier_task_segments') is not null then
    create index if not exists chantier_task_segments_status_start_idx
      on public.chantier_task_segments (chantier_id, status, start_date);
  end if;
end $$;
