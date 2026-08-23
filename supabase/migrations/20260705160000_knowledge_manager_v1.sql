create table if not exists public.knowledge_versions (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('product','task_template','lot_profile','field_knowledge','other')),
  target_id text not null,
  version_number integer not null,
  previous_version_id uuid null references public.knowledge_versions(id) on delete set null,
  snapshot jsonb not null,
  change_source text not null check (change_source in ('ai_improvement','manual','rollback','system')),
  improvement_id uuid null references public.knowledge_improvements(id) on delete set null,
  created_by uuid null,
  created_at timestamptz not null default now(),
  reason text null,
  confidence text null,
  metadata jsonb not null default '{}'::jsonb,
  constraint knowledge_versions_unique_target_version unique (target_type, target_id, version_number)
);

create table if not exists public.knowledge_change_audit (
  id uuid primary key default gen_random_uuid(),
  improvement_id uuid null references public.knowledge_improvements(id) on delete set null,
  target_type text not null check (target_type in ('product','task_template','lot_profile','field_knowledge','other')),
  target_id text not null,
  action text not null check (action in ('simulated','accepted','rejected','modified','applied','rollback')),
  before_snapshot jsonb null,
  after_snapshot jsonb null,
  diff jsonb null,
  actor_id uuid null,
  actor_label text null,
  reason text null,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.knowledge_impact_simulations (
  id uuid primary key default gen_random_uuid(),
  improvement_id uuid null references public.knowledge_improvements(id) on delete set null,
  target_type text not null check (target_type in ('product','task_template','lot_profile','field_knowledge','other')),
  target_id text not null,
  impacted_products integer not null default 0,
  impacted_templates integer not null default 0,
  impacted_quotes integer not null default 0,
  impacted_chantiers integer not null default 0,
  impacted_doe integer not null default 0,
  cost_before jsonb null,
  cost_after jsonb null,
  diff jsonb null,
  warnings text[] not null default '{}'::text[],
  created_by uuid null,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists knowledge_versions_target_idx on public.knowledge_versions(target_type, target_id);
create index if not exists knowledge_versions_improvement_idx on public.knowledge_versions(improvement_id);
create index if not exists knowledge_versions_created_at_idx on public.knowledge_versions(created_at desc);
create index if not exists knowledge_change_audit_improvement_idx on public.knowledge_change_audit(improvement_id);
create index if not exists knowledge_change_audit_target_idx on public.knowledge_change_audit(target_type, target_id);
create index if not exists knowledge_change_audit_action_idx on public.knowledge_change_audit(action);
create index if not exists knowledge_change_audit_created_at_idx on public.knowledge_change_audit(created_at desc);
create index if not exists knowledge_impact_simulations_improvement_idx on public.knowledge_impact_simulations(improvement_id);
create index if not exists knowledge_impact_simulations_target_idx on public.knowledge_impact_simulations(target_type, target_id);
create index if not exists knowledge_impact_simulations_created_at_idx on public.knowledge_impact_simulations(created_at desc);

alter table public.knowledge_versions enable row level security;
alter table public.knowledge_change_audit enable row level security;
alter table public.knowledge_impact_simulations enable row level security;

drop policy if exists knowledge_versions_select on public.knowledge_versions;
create policy knowledge_versions_select on public.knowledge_versions for select to authenticated using (true);
drop policy if exists knowledge_versions_admin on public.knowledge_versions;
create policy knowledge_versions_admin on public.knowledge_versions for all to authenticated using (public.batipro_is_admin()) with check (public.batipro_is_admin());

drop policy if exists knowledge_change_audit_select on public.knowledge_change_audit;
create policy knowledge_change_audit_select on public.knowledge_change_audit for select to authenticated using (true);
drop policy if exists knowledge_change_audit_admin on public.knowledge_change_audit;
create policy knowledge_change_audit_admin on public.knowledge_change_audit for all to authenticated using (public.batipro_is_admin()) with check (public.batipro_is_admin());

drop policy if exists knowledge_impact_simulations_select on public.knowledge_impact_simulations;
create policy knowledge_impact_simulations_select on public.knowledge_impact_simulations for select to authenticated using (true);
drop policy if exists knowledge_impact_simulations_admin on public.knowledge_impact_simulations;
create policy knowledge_impact_simulations_admin on public.knowledge_impact_simulations for all to authenticated using (public.batipro_is_admin()) with check (public.batipro_is_admin());

grant select, insert, update, delete on public.knowledge_versions to authenticated;
grant select, insert, update, delete on public.knowledge_change_audit to authenticated;
grant select, insert, update, delete on public.knowledge_impact_simulations to authenticated;
