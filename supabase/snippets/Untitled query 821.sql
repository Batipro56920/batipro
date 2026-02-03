alter table public.chantier_intervenant_access enable row level security;

-- On part du principe : tes utilisateurs internes sont connectés via Supabase Auth.
-- Ils ont le droit de tout gérer (à restreindre plus tard avec un vrai rôle "admin").

drop policy if exists "admin_full_access_access_table" on public.chantier_intervenant_access;
create policy "admin_full_access_access_table"
on public.chantier_intervenant_access
for all
to authenticated
using (true)
with check (true);

-- IMPORTANT : aucune policy anon => anon ne peut rien lire/écrire.
