-- An edited allocation must grant the worker access to the new chantier as well.
drop trigger if exists office_planning_worker_access on public.office_planning_assignments;
create trigger office_planning_worker_access after insert or update of chantier_id,intervenant_id
on public.office_planning_assignments for each row
execute function public.office_planning_grant_chantier();
