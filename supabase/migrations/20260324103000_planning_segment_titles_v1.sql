do $$
begin
  if to_regclass('public.chantier_task_segments') is not null then
    alter table public.chantier_task_segments
      add column if not exists title_override text;
  end if;
end $$;

create index if not exists chantier_task_segments_task_start_idx
  on public.chantier_task_segments (task_id, start_date, order_in_day);
