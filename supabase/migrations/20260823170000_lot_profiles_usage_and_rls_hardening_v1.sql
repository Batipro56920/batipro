-- Migration complementaire a 20260705103000 et 20260705120000, deja appliquees
-- sur la base distante. Ces deux migrations ne doivent PAS etre reeditees :
-- toute evolution passe par ce fichier.
--
-- Elle traite deux sujets :
--   1. usage metier par defaut des profils de lot (repris du systeme localStorage) ;
--   2. correction d'une regression RLS introduite par 20260705120000.

-- ---------------------------------------------------------------------------
-- 1. Profils de lot : usage metier par defaut
-- ---------------------------------------------------------------------------
-- Remplace `TaskTemplateLotProfile.defaultUsage` de l'ancien stockage
-- localStorage, supprime au profit de la table Supabase.

alter table public.task_template_lot_profiles
  add column if not exists default_quote_visible boolean not null default true;

alter table public.task_template_lot_profiles
  add column if not exists default_chantier_visible boolean not null default true;

-- ---------------------------------------------------------------------------
-- 1 bis. Filet idempotent : company_settings.charges_exploitation
-- ---------------------------------------------------------------------------
-- 20260520120000_company_settings_charges_exploitation.sql contenait un
-- `if ... then ... end if;` hors bloc PL/pgSQL, donc du SQL invalide. Le commit
-- bc4eeb6 le corrige en l'encapsulant dans un `DO $$ ... $$` (necessaire pour
-- rejouer les migrations sur une base neuve). Si cette migration a ete comptee
-- comme appliquee sans avoir reellement cree la colonne, ce bloc la rattrape.

DO $$
BEGIN
  IF to_regclass('public.company_settings') IS NOT NULL THEN
    ALTER TABLE public.company_settings
    ADD COLUMN IF NOT EXISTS charges_exploitation jsonb;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Correction de regression RLS : public.batipro_is_admin()
-- ---------------------------------------------------------------------------
-- 20260402220000_batipro_admin_rls_v1.sql definissait cette fonction en
-- `security definer` + `set search_path = public, pg_temp`.
-- 20260705120000_field_knowledge_engine_v1.sql l'a redefinie via
-- `create or replace` SANS ces deux attributs, ce qui :
--   - fait lire public.profiles sous les RLS de l'appelant (la fonction renvoie
--     alors false pour tout le monde, cassant toutes les policies admin) ;
--   - rouvre un vecteur d'injection par search_path sur une fonction utilisee
--     dans des policies.
-- On restaure ici la definition durcie d'origine.

create or replace function public.batipro_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'ADMIN'
  );
$$;

-- ---------------------------------------------------------------------------
-- 3. Durcissement de public.batipro_can_access_field_task(uuid)
-- ---------------------------------------------------------------------------
-- Meme traitement : la fonction est utilisee dans les policies de
-- field_execution_logs, field_feedback, photo_requirements et doe_requirements.
-- Sans `security definer`, ses lectures de chantier_tasks / intervenants /
-- chantier_task_assignees sont elles-memes filtrees par les RLS de l'appelant.
-- Corps fonctionnel identique a 20260705120000.

create or replace function public.batipro_can_access_field_task(p_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.batipro_is_admin()
    or exists (
      select 1
      from public.chantier_tasks t
      join public.intervenants i on i.id = t.intervenant_id
      where t.id = p_task_id
        and i.email = auth.email()
    )
    or exists (
      select 1
      from public.chantier_task_assignees cta
      join public.intervenants i on i.id = cta.intervenant_id
      where cta.task_id = p_task_id
        and i.email = auth.email()
    );
$$;
