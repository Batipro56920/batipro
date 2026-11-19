-- Assertions are run only against the disposable GitHub Actions PostgreSQL service.
do $tests$
declare
  a uuid := '00000000-0000-0000-0000-000000000011';
  b uuid := '00000000-0000-0000-0000-000000000012';
  w1 uuid := '00000000-0000-0000-0000-000000000021';
  w2 uuid := '00000000-0000-0000-0000-000000000022';
  org uuid := '00000000-0000-0000-0000-000000000001';
  cancelled_id uuid;
  failed boolean;
begin
  -- Assign worker 1 to A. A task on A is allowed; a task on B is blocked.
  perform public.office_planning_save(null::uuid, a, w1, '2026-11-10', '2026-11-10', '{}'::text[]);
  insert into public.chantier_task_segments(chantier_id,intervenant_id,start_date,duration_days,status)
    values(a,w1,'2026-11-10',1,'planifie');
  failed := false;
  begin
    insert into public.chantier_task_segments(chantier_id,intervenant_id,start_date,duration_days,status)
      values(b,w1,'2026-11-10',1,'planifie');
  exception when raise_exception then
    if sqlerrm = 'worker_office_on_other_chantier' then failed := true; else raise; end if;
  end;
  if not failed then raise exception 'Expected task conflict on another chantier'; end if;

  -- A cancelled task is permitted, but activating it is blocked.
  insert into public.chantier_task_segments(chantier_id,intervenant_id,start_date,duration_days,status)
    values(b,w1,'2026-11-10',1,'annule') returning id into cancelled_id;
  failed := false;
  begin
    update public.chantier_task_segments set status='planifie' where id=cancelled_id;
  exception when raise_exception then
    if sqlerrm = 'worker_office_on_other_chantier' then failed := true; else raise; end if;
  end;
  if not failed then raise exception 'Expected reactivation conflict'; end if;

  -- Direct writes to office assignments cannot bypass the RPC conflict guard.
  failed := false;
  begin
    insert into public.office_planning_assignments(organization_id,chantier_id,intervenant_id,date_start,date_end)
      values(org,b,w1,'2026-11-10','2026-11-10');
  exception when raise_exception then
    if sqlerrm = 'worker_task_on_other_chantier' then failed := true; else raise; end if;
  end;
  if not failed then raise exception 'Expected direct office assignment conflict'; end if;

  -- The office RPC must also reject existing tasks on another chantier.
  insert into public.chantier_task_segments(chantier_id,intervenant_id,start_date,duration_days,status)
    values(b,w2,'2026-11-12',1,'planifie');
  failed := false;
  begin
    perform public.office_planning_save(null::uuid,a,w2,'2026-11-12','2026-11-12','{}'::text[]);
  exception when raise_exception then
    if sqlerrm = 'worker_task_on_other_chantier' then failed := true; else raise; end if;
  end;
  if not failed then raise exception 'Expected office RPC conflict'; end if;

  -- Planning on the same chantier is allowed.
  perform public.office_planning_save(null::uuid,b,w2,'2026-11-12','2026-11-12','{}'::text[]);

  -- Legacy segment table also participates in both guards.
  insert into public.chantier_task_planning_segments(chantier_id,intervenant_id,start_date,duration_days,status)
    values(b,w2,'2026-11-14',1.5,'planifie');
  failed := false;
  begin
    perform public.office_planning_save(null::uuid,a,w2,'2026-11-15','2026-11-15','{}'::text[]);
  exception when raise_exception then
    if sqlerrm = 'worker_task_on_other_chantier' then failed := true; else raise; end if;
  end;
  if not failed then raise exception 'Expected legacy multi-day segment conflict'; end if;

  if (select count(*) from public.office_planning_assignments) <> 2 then
    raise exception 'Unexpected office assignment count';
  end if;
  raise notice 'Planning migration smoke tests passed';
end
$tests$;
