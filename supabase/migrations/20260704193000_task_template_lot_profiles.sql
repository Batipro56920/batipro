create table if not exists public.task_template_lot_profiles (
  id text primary key,
  label text not null,
  keywords text[] not null default '{}',
  labor_margin_rate numeric not null default 30,
  default_unit text not null default 'u',
  quote_visible_default boolean not null default true,
  chantier_visible_default boolean not null default true,
  field_guidance text not null default '',
  default_tools text[] not null default '{}',
  default_controls text[] not null default '{}',
  default_errors_to_avoid text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.task_template_lot_profiles enable row level security;

create policy if not exists "Authenticated users can read lot profiles"
  on public.task_template_lot_profiles
  for select
  to authenticated
  using (true);

create policy if not exists "Authenticated users can manage lot profiles"
  on public.task_template_lot_profiles
  for all
  to authenticated
  using (true)
  with check (true);

insert into public.task_template_lot_profiles (id, label, keywords, labor_margin_rate, default_unit, quote_visible_default, chantier_visible_default, field_guidance)
values
  ('electricite', 'Electricite', array['electricite','elec','courant fort','courant faible'], 55, 'u', true, true, 'Verifier reperage, continuite, protections, essais et conformite avant fermeture.'),
  ('platrerie', 'Platrerie', array['platrerie','placo','cloison','doublage','isolation'], 30, 'm2', true, true, 'Verifier planeite, aplomb, fixation, traitement des joints et reservations avant finition.'),
  ('peinture', 'Peinture', array['peinture','revetement mural','papier peint'], 30, 'm2', true, true, 'Verifier preparation support, teinte, nombre de couches, sechage et aspect final a la lumiere.'),
  ('plomberie', 'Plomberie', array['plomberie','sanitaire','chauffage','cvc'], 45, 'u', true, true, 'Verifier etancheite, raccordements, essais, accessibilite et reservations avant fermeture.'),
  ('menuiserie', 'Menuiserie', array['menuiserie','agencement'], 35, 'u', true, true, 'Verifier cotes, niveau, aplomb, fixations, jeux et protections avant reception.'),
  ('sols-carrelage', 'Sols / carrelage', array['sol','carrelage','parquet','faience'], 35, 'm2', true, true, 'Verifier support, calepinage, joints, planeite, coupes et temps de sechage.'),
  ('facade', 'Facade', array['facade','ite','ravalement'], 35, 'm2', true, true, 'Verifier support, meteo, protection des abords, consommation, sechage et aspect final.')
on conflict (id) do update set
  label = excluded.label,
  keywords = excluded.keywords,
  labor_margin_rate = excluded.labor_margin_rate,
  default_unit = excluded.default_unit,
  quote_visible_default = excluded.quote_visible_default,
  chantier_visible_default = excluded.chantier_visible_default,
  field_guidance = excluded.field_guidance,
  updated_at = now();
