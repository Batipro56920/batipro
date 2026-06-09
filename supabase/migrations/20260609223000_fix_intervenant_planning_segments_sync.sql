-- Sync admin planning segments with the intervenant portal planning view.

drop function if exists public.intervenant_get_planning(text, uuid);
create or replace function public.intervenant_get_planning(p_token text, p_chantier_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_intervenant_id uuid;
  v_has_lot_planning boolean;
  v_has_lot_column boolean;
  v_has_segment_columns boolean;
  v_lots jsonb := '[]'::jsonb;
  v_segment_table text;
begin
  v_intervenant_id := public._intervenant_assert_chantier_access(p_token, p_chantier_id);

  foreach v_segment_table in array array['chantier_task_segments', 'chantier_task_planning_segments']
  loop
    exit when coalesce(jsonb_array_length(v_lots), 0) > 0;

    if to_regclass(format('public.%s', v_segment_table)) is not null then
      select count(*) = 5
      into v_has_segment_columns
      from information_schema.columns
      where table_schema = 'public'
        and table_name = v_segment_table
        and column_name in ('start_date', 'duration_days', 'order_in_day', 'status', 'progress_percent');

      if v_has_segment_columns then
        execute format(
          $query$
          with segment_summary as (
            select
              trim(coalesce(nullif(t.lot, ''), nullif(t.corps_etat, ''), 'A classer')) as lot,
              min(s.start_date)::date as start_date,
              max(
                (
                  s.start_date
                  + greatest(ceil(greatest(coalesce(s.duration_days, t.duration_days, 1), 0.25))::integer - 1, 0)
                )
              )::date as end_date,
              min(coalesce(s.order_in_day, t.order_index, 0))::integer as order_index,
              sum(greatest(coalesce(s.duration_days, t.duration_days, 1), 0.25))::numeric as total_duration_days,
              count(distinct t.id)::integer as total_tasks,
              count(distinct t.id) filter (
                where coalesce(s.status, '') = 'termine'
                   or upper(coalesce(t.status, '')) in ('FAIT', 'TERMINE', 'DONE', 'COMPLETED')
              )::integer as done_tasks,
              round(
                avg(
                  coalesce(
                    s.progress_percent,
                    case
                      when coalesce(s.status, '') = 'termine'
                        or upper(coalesce(t.status, '')) in ('FAIT', 'TERMINE', 'DONE', 'COMPLETED')
                        then 100
                      else 0
                    end
                  )
                ),
                1
              )::numeric as progress_pct
            from public.%I s
            join public.chantier_tasks t
              on t.id = s.task_id
            where s.chantier_id = $1
              and coalesce(s.status, 'planifie') <> 'annule'
              and (
                $2 is null
                or s.intervenant_id = $2
                or t.intervenant_id = $2
                or exists (
                  select 1
                  from public.chantier_task_assignees cta
                  where cta.task_id = t.id
                    and cta.intervenant_id = $2
                )
              )
            group by 1
          )
          select coalesce(
            jsonb_agg(
              jsonb_build_object(
                'lot', lot,
                'start_date', start_date,
                'end_date', end_date,
                'order_index', order_index,
                'total_duration_days', round(total_duration_days, 2),
                'total_tasks', total_tasks,
                'done_tasks', done_tasks,
                'progress_pct',
                  case
                    when total_tasks = 0 then 0
                    else greatest(progress_pct, round((done_tasks::numeric * 100.0) / total_tasks, 1))
                  end
              )
              order by start_date nulls last, order_index, lot
            ),
            '[]'::jsonb
          )
          from segment_summary
          $query$,
          v_segment_table
        )
        into v_lots
        using p_chantier_id, v_intervenant_id;
      end if;
    end if;
  end loop;

  v_has_lot_planning := to_regclass('public.chantier_lot_planning') is not null;

  if coalesce(jsonb_array_length(v_lots), 0) = 0 and v_has_lot_planning then
    select exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'chantier_lot_planning'
        and column_name = 'lot'
    ) into v_has_lot_column;

    if v_has_lot_column then
      with chantier_scope as (
        select
          c.id,
          c.planning_start_date,
          c.planning_end_date,
          c.date_debut,
          c.date_fin_prevue
        from public.chantiers c
        where c.id = p_chantier_id
      ),
      task_summary as (
        select
          trim(coalesce(nullif(t.lot, ''), nullif(t.corps_etat, ''), 'A classer')) as lot,
          min(t.date_debut) as task_start,
          max(t.date_fin) as task_end,
          sum(greatest(coalesce(t.duration_days, 1), 1))::integer as total_duration_days,
          count(*)::integer as total_tasks,
          count(*) filter (where upper(coalesce(t.status, '')) in ('FAIT', 'TERMINE', 'DONE', 'COMPLETED'))::integer as done_tasks
        from public.chantier_tasks t
        where t.chantier_id = p_chantier_id
          and (
            v_intervenant_id is null
            or t.intervenant_id = v_intervenant_id
            or exists (
              select 1
              from public.chantier_task_assignees cta
              where cta.task_id = t.id
                and cta.intervenant_id = v_intervenant_id
            )
          )
        group by 1
      )
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'lot', lp.lot,
            'start_date', coalesce(lp.start_date, ts.task_start, cs.planning_start_date, cs.date_debut),
            'end_date',
              coalesce(
                lp.end_date,
                ts.task_end,
                cs.planning_end_date,
                cs.date_fin_prevue,
                case
                  when coalesce(lp.start_date, ts.task_start, cs.planning_start_date, cs.date_debut) is not null
                    then (coalesce(lp.start_date, ts.task_start, cs.planning_start_date, cs.date_debut)
                          + greatest(coalesce(ts.total_duration_days, 1) - 1, 0))
                  else null
                end
              ),
            'order_index', lp.order_index,
            'total_duration_days', coalesce(ts.total_duration_days, 0),
            'total_tasks', coalesce(ts.total_tasks, 0),
            'done_tasks', coalesce(ts.done_tasks, 0),
            'progress_pct',
              case
                when coalesce(ts.total_tasks, 0) = 0 then 0
                else round((ts.done_tasks::numeric * 100.0) / ts.total_tasks, 1)
              end
          )
          order by lp.order_index, lp.lot
        ),
        '[]'::jsonb
      )
      into v_lots
      from public.chantier_lot_planning lp
      left join task_summary ts
        on ts.lot = lp.lot
      cross join chantier_scope cs
      where lp.chantier_id = p_chantier_id;
    end if;
  end if;

  if coalesce(jsonb_array_length(v_lots), 0) = 0 then
    with task_summary as (
      select
        trim(coalesce(nullif(t.lot, ''), nullif(t.corps_etat, ''), 'A classer')) as lot,
        min(t.date_debut) as task_start,
        max(t.date_fin) as task_end,
        sum(greatest(coalesce(t.duration_days, 1), 1))::integer as total_duration_days,
        count(*)::integer as total_tasks,
        count(*) filter (where upper(coalesce(t.status, '')) in ('FAIT', 'TERMINE', 'DONE', 'COMPLETED'))::integer as done_tasks,
        min(coalesce(t.order_index, 0))::integer as order_index
      from public.chantier_tasks t
      where t.chantier_id = p_chantier_id
        and (
          v_intervenant_id is null
          or t.intervenant_id = v_intervenant_id
          or exists (
            select 1
            from public.chantier_task_assignees cta
            where cta.task_id = t.id
              and cta.intervenant_id = v_intervenant_id
          )
        )
      group by 1
    )
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'lot', ts.lot,
          'start_date', ts.task_start,
          'end_date', coalesce(ts.task_end, case when ts.task_start is not null then ts.task_start + greatest(ts.total_duration_days - 1, 0) else null end),
          'order_index', ts.order_index,
          'total_duration_days', ts.total_duration_days,
          'total_tasks', ts.total_tasks,
          'done_tasks', ts.done_tasks,
          'progress_pct', case when ts.total_tasks = 0 then 0 else round((ts.done_tasks::numeric * 100.0) / ts.total_tasks, 1) end
        )
        order by ts.order_index, ts.lot
      ),
      '[]'::jsonb
    )
    into v_lots
    from task_summary ts;
  end if;

  return jsonb_build_object(
    'chantier_id', p_chantier_id,
    'lots', coalesce(v_lots, '[]'::jsonb)
  );
end;
$$;

drop function if exists public.intervenant_get_planning(text);
create or replace function public.intervenant_get_planning(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_session jsonb;
  v_chantier_id uuid;
begin
  v_session := public.intervenant_session(p_token);
  v_chantier_id := nullif(v_session ->> 'default_chantier_id', '')::uuid;

  if v_chantier_id is null then
    raise exception 'chantier_id_required';
  end if;

  return public.intervenant_get_planning(p_token, v_chantier_id);
end;
$$;

revoke all on function public.intervenant_get_planning(text, uuid) from public;
revoke all on function public.intervenant_get_planning(text) from public;

grant execute on function public.intervenant_get_planning(text, uuid) to anon, authenticated;
grant execute on function public.intervenant_get_planning(text) to anon, authenticated;