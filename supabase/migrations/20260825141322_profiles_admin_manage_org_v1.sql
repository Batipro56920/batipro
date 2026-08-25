-- profiles n'avait que profiles_read_own / profiles_update_own (auth.uid() = id) :
-- un ADMIN ne pouvait donc jamais lire ni écrire le profil d'un·e collègue. Toute
-- tentative de rattacher un profil type ou de personnaliser un droit pour une
-- autre personne échouait silencieusement (0 ligne affectée, aucune erreur
-- Postgrest côté client) — la case à cocher se réinitialisait sans explication.
--
-- Ajoute, en plus des policies existantes (inchangées), le droit pour un ADMIN
-- de lire/modifier les profils de sa propre organisation. current_organization_id()
-- est SECURITY DEFINER (contourne la RLS de profiles en interne), donc aucun
-- risque de récursion malgré la référence à profiles dans son propre corps.

drop policy if exists profiles_admin_select_org on public.profiles;
create policy profiles_admin_select_org
  on public.profiles
  for select
  to authenticated
  using (
    public.is_admin()
    and organization_id = public.current_organization_id()
  );

drop policy if exists profiles_admin_update_org on public.profiles;
create policy profiles_admin_update_org
  on public.profiles
  for update
  to authenticated
  using (
    public.is_admin()
    and organization_id = public.current_organization_id()
  )
  with check (
    public.is_admin()
    and organization_id = public.current_organization_id()
  );
