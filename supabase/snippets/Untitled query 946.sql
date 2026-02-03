/* =========================================================
   1) FIX CRITIQUE : is_intervenant_portal() ne doit JAMAIS renvoyer NULL
   ========================================================= */

create or replace function public.is_intervenant_portal()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() ->> 'access_role', '') = 'INTERVENANT';
$$;


/* =========================================================
   2) POLICIES ADMIN pour chantier_tasks
   - admin = authenticated ET PAS intervenant portail
   ========================================================= */

-- SELECT (admin)
drop policy if exists "admin_select_tasks" on public.chantier_tasks;

create policy "admin_select_tasks"
on public.chantier_tasks
for select
to authenticated
using (
  not public.is_intervenant_portal()
);

-- INSERT (admin)
drop policy if exists "admin_insert_tasks" on public.chantier_tasks;

create policy "admin_insert_tasks"
on public.chantier_tasks
for insert
to authenticated
with check (
  not public.is_intervenant_portal()
);

-- UPDATE (admin)  ✅ recommandé sinon tu peux te bloquer selon tes autres policies
drop policy if exists "admin_update_tasks" on public.chantier_tasks;

create policy "admin_update_tasks"
on public.chantier_tasks
for update
to authenticated
using (
  not public.is_intervenant_portal()
)
with check (
  not public.is_intervenant_portal()
);

-- DELETE (admin)
drop policy if exists "admin_delete_tasks" on public.chantier_tasks;

create policy "admin_delete_tasks"
on public.chantier_tasks
for delete
to authenticated
using (
  not public.is_intervenant_portal()
);
