do $$
begin
  if to_regclass('public.company_settings') is not null then
    alter table public.company_settings
      add column if not exists mode_interface text not null default 'terrain';

    update public.company_settings
    set mode_interface = case
      when mode_interface in ('pilotage', 'terrain') then mode_interface
      when business_profile in ('architecte', 'maitre_oeuvre') then 'pilotage'
      else 'terrain'
    end;

    if not exists (
      select 1
      from pg_constraint
      where conrelid = 'public.company_settings'::regclass
        and conname = 'company_settings_mode_interface_chk'
    ) then
      alter table public.company_settings
        add constraint company_settings_mode_interface_chk
        check (mode_interface in ('pilotage', 'terrain'));
    end if;
  end if;
end $$;
