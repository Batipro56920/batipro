do $$
begin
  if to_regclass('public.company_settings') is not null then
    alter table public.company_settings
      add column if not exists business_profile text not null default 'entreprise_renovation',
      add column if not exists feature_mode text not null default 'simple',
      add column if not exists enabled_modules jsonb not null default '[]'::jsonb;

    update public.company_settings
    set
      business_profile = coalesce(nullif(btrim(business_profile), ''), 'entreprise_renovation'),
      feature_mode = case
        when feature_mode = 'avance' then 'avance'
        else 'simple'
      end,
      enabled_modules = case
        when jsonb_typeof(enabled_modules) = 'array' and jsonb_array_length(enabled_modules) > 0
          then enabled_modules
        else '[
          "preparation_chantier",
          "zones_localisation",
          "approvisionnement",
          "documents",
          "taches",
          "planning",
          "photos",
          "consignes",
          "messagerie",
          "reserves",
          "validation_qualite",
          "journal_chantier",
          "doe",
          "temps",
          "budget",
          "ecarts",
          "rapports"
        ]'::jsonb
      end;

    if not exists (
      select 1
      from pg_constraint
      where conrelid = 'public.company_settings'::regclass
        and conname = 'company_settings_business_profile_chk'
    ) then
      alter table public.company_settings
        add constraint company_settings_business_profile_chk
        check (
          business_profile in (
            'entreprise_renovation',
            'maitre_oeuvre',
            'architecte',
            'artisan',
            'sous_traitant'
          )
        );
    end if;

    if not exists (
      select 1
      from pg_constraint
      where conrelid = 'public.company_settings'::regclass
        and conname = 'company_settings_feature_mode_chk'
    ) then
      alter table public.company_settings
        add constraint company_settings_feature_mode_chk
        check (feature_mode in ('simple', 'avance'));
    end if;
  end if;
end $$;
