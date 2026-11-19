-- The caller must not inherit the view owner's privilege to read times.
do $$
begin
 if not exists (
   select 1 from pg_class where oid='public.chantier_task_time_totals'::regclass
   and 'security_invoker=true' = any(reloptions)
 ) then raise exception 'View is not security invoker'; end if;
 if has_table_privilege('anon','public.chantier_task_time_totals','SELECT') then
   raise exception 'Anonymous access still exists';
 end if;
 if not has_table_privilege('authenticated','public.chantier_task_time_totals','SELECT') then
   raise exception 'Authenticated read should remain available under RLS';
 end if;
end $$;
set role authenticated;
do $$
begin
 if (select count(*) from public.chantier_task_time_totals) <> 0 then
   raise exception 'View bypassed underlying pointages RLS';
 end if;
end $$;
reset role;
