do $$
begin
  if to_regclass('public.chantier_tasks') is not null then
    alter table public.chantier_tasks
      add column if not exists titre_terrain text,
      add column if not exists libelle_devis_original text,
      add column if not exists duration_days numeric,
      add column if not exists order_index integer,
      add column if not exists planned_duration_days numeric;

    update public.chantier_tasks
    set
      duration_days = coalesce(duration_days, 1),
      order_index = coalesce(order_index, 0),
      planned_duration_days = coalesce(planned_duration_days, duration_days, 1),
      titre_terrain = coalesce(nullif(btrim(titre_terrain), ''), nullif(btrim(titre), ''), 'Sans titre'),
      libelle_devis_original = coalesce(
        nullif(btrim(libelle_devis_original), ''),
        nullif(btrim(titre_terrain), ''),
        nullif(btrim(titre), ''),
        'Sans titre'
      );

    alter table public.chantier_tasks
      alter column duration_days set default 1,
      alter column order_index set default 0,
      alter column planned_duration_days set default 1;
  end if;
end $$;

do $$
begin
  if to_regclass('public.chantier_tasks') is not null
     and to_regclass('public.devis_lignes') is not null
     and exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'chantier_tasks'
         and column_name = 'devis_ligne_id'
     ) then
    update public.chantier_tasks t
    set
      titre_terrain = coalesce(nullif(btrim(t.titre_terrain), ''), nullif(btrim(t.titre), ''), 'Sans titre'),
      libelle_devis_original = coalesce(
        nullif(btrim(t.libelle_devis_original), ''),
        nullif(btrim(dl.designation), ''),
        nullif(btrim(t.titre), ''),
        'Sans titre'
      )
    from public.devis_lignes dl
    where dl.id = t.devis_ligne_id
      and (
        t.titre_terrain is null
        or btrim(t.titre_terrain) = ''
        or t.libelle_devis_original is null
        or btrim(t.libelle_devis_original) = ''
      );
  end if;
end $$;

do $$
begin
  if to_regclass('public.chantier_tasks') is not null then
    execute $fn$
      create or replace function public._chantier_task_display_title(p_task public.chantier_tasks)
      returns text
      language sql
      stable
      set search_path = public
      as $inner$
        select coalesce(
          nullif(btrim(p_task.titre_terrain), ''),
          nullif(btrim(p_task.titre), ''),
          'Sans titre'
        );
      $inner$;
    $fn$;

    revoke all on function public._chantier_task_display_title(public.chantier_tasks) from public;
  end if;
end $$;

do $$
declare
  v_table text;
begin
  foreach v_table in array array['chantier_task_segments', 'chantier_task_planning_segments']
  loop
    if to_regclass(format('public.%s', v_table)) is not null then
      execute format(
        'alter table public.%I
          add column if not exists start_date date,
          add column if not exists duration_days numeric,
          add column if not exists order_in_day integer,
          add column if not exists title_override text,
          add column if not exists progress_percent numeric,
          add column if not exists status text,
          add column if not exists comment text',
        v_table
      );

      execute format(
        'update public.%I
         set
           start_date = coalesce(start_date, (start_at at time zone ''UTC'')::date),
           duration_days = coalesce(
             duration_days,
             greatest(0.25, round((extract(epoch from (end_at - start_at)) / 86400.0)::numeric * 4) / 4)
           ),
           order_in_day = coalesce(order_in_day, 0),
           status = coalesce(nullif(btrim(status), ''''), ''planifie'')
         where
           start_date is null
           or duration_days is null
           or order_in_day is null
           or status is null
           or btrim(status) = ''''',
        v_table
      );

      execute format(
        'with ranked as (
           select
             id,
             row_number() over (
               partition by chantier_id, coalesce(intervenant_id, ''00000000-0000-0000-0000-000000000000''::uuid), start_date
               order by coalesce(created_at, now()), id
             ) - 1 as rn
           from public.%I
         )
         update public.%I s
         set order_in_day = ranked.rn
         from ranked
         where ranked.id = s.id',
        v_table,
        v_table
      );
    end if;
  end loop;
end $$;

do $$
begin
  if to_regclass('public.chantier_task_segments') is not null
     and not exists (
       select 1
       from pg_constraint
       where conrelid = 'public.chantier_task_segments'::regclass
         and conname = 'chantier_task_segments_duration_days_chk'
     ) then
    alter table public.chantier_task_segments
      add constraint chantier_task_segments_duration_days_chk
      check (duration_days >= 0.25);
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
    create index if not exists chantier_task_segments_repair_start_idx
      on public.chantier_task_segments (chantier_id, start_date, order_in_day);
  end if;
end $$;
