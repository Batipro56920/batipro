-- Paramétrage explicite des données que COCO peut utiliser pour améliorer les
-- références métier. L'analyse reste en lecture seule et toute correction doit
-- être validée par un administrateur dans son module d'origine.
create table if not exists public.coco_learning_settings (
  singleton_key text primary key default 'company' check (singleton_key = 'company'),
  enabled boolean not null default true,
  minimum_samples integer not null default 3 check (minimum_samples between 1 and 20),
  lookback_days integer not null default 180 check (lookback_days between 30 and 730),
  sources jsonb not null default '{"task_times":true,"material_consumption":true,"chantier_feed":true,"terrain_feedback":true,"reserves":true,"purchases":true,"planning":true}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null default auth.uid(),
  updated_at timestamptz not null default now()
);

alter table public.coco_learning_settings enable row level security;
drop policy if exists coco_learning_settings_admin_select on public.coco_learning_settings;
create policy coco_learning_settings_admin_select on public.coco_learning_settings for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ADMIN'));
drop policy if exists coco_learning_settings_admin_write on public.coco_learning_settings;
create policy coco_learning_settings_admin_write on public.coco_learning_settings for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ADMIN'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ADMIN'));

insert into public.coco_learning_settings (singleton_key) values ('company') on conflict do nothing;
