alter table public.chantier_tasks enable row level security;

-- Lecture : uniquement les tâches du chantier du token
drop policy if exists "portal_read_tasks_on_own_chantier" on public.chantier_tasks;
create policy "portal_read_tasks_on_own_chantier"
on public.chantier_tasks
for select
to authenticated
using (
  public.is_intervenant_portal()
  and chantier_id = public.jwt_claim_uuid('chantier_id')
);

-- Update : uniquement SES tâches + champs limités (à gérer côté front + DB via trigger si besoin)
drop policy if exists "portal_update_own_tasks" on public.chantier_tasks;
create policy "portal_update_own_tasks"
on public.chantier_tasks
for update
to authenticated
using (
  public.is_intervenant_portal()
  and chantier_id = public.jwt_claim_uuid('chantier_id')
  and assignee_id = public.jwt_claim_uuid('intervenant_id')
)
with check (
  public.is_intervenant_portal()
  and chantier_id = public.jwt_claim_uuid('chantier_id')
  and assignee_id = public.jwt_claim_uuid('intervenant_id')
);
