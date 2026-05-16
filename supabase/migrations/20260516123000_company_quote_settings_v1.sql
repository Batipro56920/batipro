create table if not exists public.company_quote_settings (
  organization_id uuid primary key default auth.uid(),
  default_vat_rate numeric(4,2) not null default 20,
  default_deposit_percent numeric(5,2) not null default 30,
  accepted_payment_methods text[] not null default array['virement']::text[],
  default_payment_terms text not null default '30% a la signature, solde selon avancement et reception des travaux.',
  default_legal_mentions text not null default 'Devis valable selon la date indiquee. Travaux soumis aux conditions generales de l''entreprise.',
  default_waste_management text not null default 'Gestion des dechets selon la reglementation applicable.',
  default_footer_notes text not null default '',
  quote_number_prefix text not null default 'DEV',
  quote_number_next integer not null default 1,
  quote_number_padding integer not null default 4,
  default_validity_days integer not null default 30,
  default_work_start_delay_days integer not null default 0,
  default_estimated_duration text,
  default_salesperson_id uuid,
  default_show_margins boolean not null default true,
  default_show_references boolean not null default false,
  default_show_vat_column boolean not null default true,
  default_show_quantity_columns boolean not null default true,
  default_hide_composite_details boolean not null default false,
  default_show_vat_certificate boolean not null default false,
  default_show_waste_management boolean not null default true,
  default_custom_numbering boolean not null default false,
  cgv text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.company_quote_settings enable row level security;

drop policy if exists company_quote_settings_org_access on public.company_quote_settings;
create policy company_quote_settings_org_access on public.company_quote_settings
  for all using (organization_id = auth.uid())
  with check (organization_id = auth.uid());

grant select, insert, update, delete on public.company_quote_settings to authenticated;
