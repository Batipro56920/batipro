-- Adds the "fil_chantier" category to terrain_feedbacks, used by the intervenant
-- portal's chantier chat (EmployeePortalV2Page) and the back-office Fil chantier
-- inbox. The original check constraint and normalization function (migration
-- 20260321120000_terrain_feedbacks_v1.sql, already applied) never included this
-- value, so every attempt to post a chantier chat message currently fails with
-- a "category_required" error. This migration is NOT applied automatically;
-- review and apply it explicitly once ready.

alter table public.terrain_feedbacks
  drop constraint if exists terrain_feedbacks_category_chk;

alter table public.terrain_feedbacks
  add constraint terrain_feedbacks_category_chk check (
    category in (
      'observation_chantier',
      'anomalie',
      'blocage',
      'suggestion',
      'qualite',
      'securite',
      'client',
      'organisation',
      'fil_chantier'
    )
  );

create or replace function public._terrain_feedback_normalize_category(p_value text)
returns text
language sql
immutable
as $$
  select case lower(regexp_replace(coalesce(p_value, ''), '\s+', '_', 'g'))
    when 'observation_chantier' then 'observation_chantier'
    when 'observation' then 'observation_chantier'
    when 'anomalie' then 'anomalie'
    when 'blocage' then 'blocage'
    when 'suggestion' then 'suggestion'
    when 'qualite' then 'qualite'
    when 'sécurité' then 'securite'
    when 'securite' then 'securite'
    when 'client' then 'client'
    when 'organisation' then 'organisation'
    when 'fil_chantier' then 'fil_chantier'
    else null
  end;
$$;
