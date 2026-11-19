do $$
declare
 a uuid:='00000000-0000-0000-0000-000000000001';
 b uuid:='00000000-0000-0000-0000-000000000002';
 c uuid:='00000000-0000-0000-0000-000000000003';
 site uuid:='00000000-0000-0000-0000-000000000011';
 time_id uuid;
 value numeric;
begin
 select hourly_cost_snapshot_ht into value from public.chantier_time_entries limit 1;
 if value is not null then raise exception 'Existing entries must remain unbackfilled'; end if;
 insert into public.chantier_time_entries(chantier_id,intervenant_id,work_date,duration_hours)
 values(site,a,'2026-11-19',7) returning id,hourly_cost_snapshot_ht into time_id,value;
 if value <> 24.92 then raise exception 'Expected cost 24.92, got %', value; end if;
 update public.intervenants set hourly_cost_ht=30 where id=a;
 update public.chantier_time_entries set duration_hours=8 where id=time_id;
 select hourly_cost_snapshot_ht into value from public.chantier_time_entries where id=time_id;
 if value <> 24.92 then raise exception 'Changing hours changed historic cost: %',value; end if;
 update public.chantier_time_entries set work_date='2026-11-20' where id=time_id;
 select hourly_cost_snapshot_ht into value from public.chantier_time_entries where id=time_id;
 if value <> 30 then raise exception 'Expected refreshed cost 30, got %',value; end if;
 insert into public.chantier_time_entries(chantier_id,intervenant_id,work_date,duration_hours)
 values(site,b,'2026-11-19',7) returning hourly_cost_snapshot_ht into value;
 if value <> 35 then raise exception 'Expected subcontractor cost 35, got %',value; end if;
 insert into public.chantier_time_entries(chantier_id,intervenant_id,work_date,duration_hours)
 values(site,c,'2026-11-19',7) returning hourly_cost_snapshot_ht into value;
 if value <> 48 then raise exception 'Expected fallback cost 48, got %',value; end if;
 if (select hourly_cost_snapshot_source from public.chantier_time_entries where intervenant_id=c order by work_date desc limit 1) <> 'chantier' then
   raise exception 'Expected explicit chantier fallback origin';
 end if;
 raise notice 'Hourly snapshot migration tests passed';
end $$;
