-- Bug : "Retours terrain" affichait 0 résultat pour tout compte bureau qui
-- n'est pas littéralement ADMIN (ex. Marie, migrée vers le rôle BUREAU par
-- 20260825170000_backoffice_role_consolidation_and_sidebar_groups_v1.sql).
-- _terrain_feedback_is_admin() n'avait jamais été mis à jour lors de cette
-- consolidation des rôles (ADMIN/BUREAU/INTERVENANT) alors que le fil
-- chantier partagé (chantier_feed_posts), lui, autorise déjà ADMIN et
-- BUREAU — d'où un blocage signalé par un ouvrier visible dans le fil
-- chantier (message texte) mais invisible dans la file "Retours terrain"
-- (RLS sur terrain_feedbacks). Aligne _terrain_feedback_is_admin() sur
-- is_backoffice() (ADMIN + BUREAU), même principe que chantier_feed_posts.

create or replace function public._terrain_feedback_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = any (array['ADMIN', 'BUREAU'])
  );
$$;
