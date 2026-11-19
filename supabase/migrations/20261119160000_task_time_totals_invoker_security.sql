-- Tighten the task time totals view without changing its definition or data.
-- INVOKER makes PostgreSQL enforce the calling user's SELECT privileges and
-- chantier_time_entries RLS. This view previously ran as its owner.
alter view public.chantier_task_time_totals set (security_invoker = true);
-- Anonymous requests must never be allowed to retrieve employee time totals.
revoke all on table public.chantier_task_time_totals from anon;
-- Existing authenticated callers retain SELECT, subject to underlying RLS.
revoke insert, update, delete, truncate, references, trigger
  on table public.chantier_task_time_totals from authenticated;
grant select on table public.chantier_task_time_totals to authenticated;
