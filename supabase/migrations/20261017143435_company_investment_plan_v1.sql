alter table public.company_settings
  add column if not exists investment_plan jsonb not null default '{"entries":[]}'::jsonb;

notify pgrst, 'reload schema';
