create table if not exists public.field_execution_logs (
  id uuid primary key default gen_random_uuid(),
  chantier_id uuid not null references public.chantiers(id) on delete cascade,
  task_id uuid not null references public.chantier_tasks(id) on delete cascade,
  intervenant_id uuid null references public.intervenants(id) on delete set null,
  log_type text not null check (log_type in ('preparation','execution','checklist','quality_control','safety','photo','document','consumption','time','issue','comment','completion')),
  status text not null default 'open' check (status in ('open','done','blocked','skipped','review')),
  title text not null,
  description text null,
  payload jsonb not null default '{}'::jsonb,
  planned_value numeric null,
  actual_value numeric null,
  unit text null,
  source text null,
  created_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz null,
  constraint field_execution_logs_title_chk check (char_length(btrim(title)) > 0)
);

create table if not exists public.field_feedback (
  id uuid primary key default gen_random_uuid(),
  chantier_id uuid not null references public.chantiers(id) on delete cascade,
  task_id uuid null references public.chantier_tasks(id) on delete set null,
  task_template_id uuid null references public.task_templates(id) on delete set null,
  product_id uuid null references public.product_catalog_items(id) on delete set null,
  intervenant_id uuid null references public.intervenants(id) on delete set null,
  feedback_type text not null default 'field_report' check (feedback_type in ('field_report','time_variance','quantity_variance','missing_equipment','missing_product','support_issue','weather_issue','difficulty','remark','suggestion')),
  work_date date null,
  planned_time_hours numeric null,
  actual_time_hours numeric null,
  planned_quantity numeric null,
  actual_quantity numeric null,
  unit text null,
  missing_equipment text[] not null default '{}'::text[],
  missing_products text[] not null default '{}'::text[],
  support_problem text null,
  weather_conditions text null,
  difficulty text null,
  remark text null,
  suggestion text null,
  source_feedback_id uuid null,
  attachments jsonb not null default '[]'::jsonb,
  analysis jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.photo_requirements (
  id uuid primary key default gen_random_uuid(),
  chantier_id uuid not null references public.chantiers(id) on delete cascade,
  task_id uuid not null references public.chantier_tasks(id) on delete cascade,
  title text not null,
  description text null,
  phase text not null default 'during' check (phase in ('before','during','after','doe','quality')),
  is_required boolean not null default true,
  expected_count integer not null default 1 check (expected_count >= 0),
  status text not null default 'pending' check (status in ('pending','received','validated','waived')),
  source text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint photo_requirements_title_chk check (char_length(btrim(title)) > 0)
);

create table if not exists public.doe_requirements (
  id uuid primary key default gen_random_uuid(),
  chantier_id uuid not null references public.chantiers(id) on delete cascade,
  task_id uuid null references public.chantier_tasks(id) on delete cascade,
  product_id uuid null references public.product_catalog_items(id) on delete set null,
  title text not null,
  requirement_type text not null default 'technical_document' check (requirement_type in ('technical_sheet','manual','sds','application_domain','photo','quality_record','technical_document','other')),
  is_required boolean not null default true,
  status text not null default 'pending' check (status in ('pending','attached','validated','waived')),
  source text null,
  document_id uuid null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint doe_requirements_title_chk check (char_length(btrim(title)) > 0)
);

create table if not exists public.knowledge_improvements (
  id uuid primary key default gen_random_uuid(),
  improvement_type text not null check (improvement_type in ('ratio','time','equipment','consumable','mistake','control','procedure','ppe','doe','pricing','other')),
  chantier_id uuid null references public.chantiers(id) on delete set null,
  task_id uuid null references public.chantier_tasks(id) on delete set null,
  task_template_id uuid null references public.task_templates(id) on delete set null,
  product_id uuid null references public.product_catalog_items(id) on delete set null,
  lot text null,
  current_value jsonb not null default '{}'::jsonb,
  proposed_value jsonb not null default '{}'::jsonb,
  reason text not null,
  confidence text not null default 'low' check (confidence in ('high','medium','low')),
  chantier_count integer not null default 1 check (chantier_count >= 0),
  validation_required boolean not null default true,
  status text not null default 'pending' check (status in ('pending','accepted','rejected','modified','archived')),
  reviewer_id uuid null,
  reviewer_comment text null,
  reviewed_at timestamptz null,
  source jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint knowledge_improvements_reason_chk check (char_length(btrim(reason)) > 0)
);

create index if not exists field_execution_logs_task_idx on public.field_execution_logs(task_id, log_type, status);
create index if not exists field_feedback_task_idx on public.field_feedback(task_id, feedback_type, created_at desc);
create index if not exists photo_requirements_task_idx on public.photo_requirements(task_id, phase, status);
create index if not exists doe_requirements_task_idx on public.doe_requirements(task_id, status);
create index if not exists knowledge_improvements_status_idx on public.knowledge_improvements(status, created_at desc);
create index if not exists knowledge_improvements_target_idx on public.knowledge_improvements(product_id, task_template_id, improvement_type);

create or replace function public.field_knowledge_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_field_execution_logs_updated_at on public.field_execution_logs;
create trigger trg_field_execution_logs_updated_at before update on public.field_execution_logs for each row execute function public.field_knowledge_touch_updated_at();

drop trigger if exists trg_field_feedback_updated_at on public.field_feedback;
create trigger trg_field_feedback_updated_at before update on public.field_feedback for each row execute function public.field_knowledge_touch_updated_at();

drop trigger if exists trg_photo_requirements_updated_at on public.photo_requirements;
create trigger trg_photo_requirements_updated_at before update on public.photo_requirements for each row execute function public.field_knowledge_touch_updated_at();

drop trigger if exists trg_doe_requirements_updated_at on public.doe_requirements;
create trigger trg_doe_requirements_updated_at before update on public.doe_requirements for each row execute function public.field_knowledge_touch_updated_at();

drop trigger if exists trg_knowledge_improvements_updated_at on public.knowledge_improvements;
create trigger trg_knowledge_improvements_updated_at before update on public.knowledge_improvements for each row execute function public.field_knowledge_touch_updated_at();

alter table public.field_execution_logs enable row level security;
alter table public.field_feedback enable row level security;
alter table public.photo_requirements enable row level security;
alter table public.doe_requirements enable row level security;
alter table public.knowledge_improvements enable row level security;

create or replace function public.batipro_is_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'ADMIN'
  );
$$;

create or replace function public.batipro_can_access_field_task(p_task_id uuid)
returns boolean
language sql
stable
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

drop policy if exists field_execution_logs_select on public.field_execution_logs;
create policy field_execution_logs_select on public.field_execution_logs for select to authenticated using (public.batipro_can_access_field_task(task_id));
drop policy if exists field_execution_logs_write on public.field_execution_logs;
create policy field_execution_logs_write on public.field_execution_logs for all to authenticated using (public.batipro_can_access_field_task(task_id)) with check (public.batipro_can_access_field_task(task_id));

drop policy if exists field_feedback_select on public.field_feedback;
create policy field_feedback_select on public.field_feedback for select to authenticated using (task_id is null or public.batipro_can_access_field_task(task_id) or public.batipro_is_admin());
drop policy if exists field_feedback_write on public.field_feedback;
create policy field_feedback_write on public.field_feedback for all to authenticated using (task_id is null or public.batipro_can_access_field_task(task_id) or public.batipro_is_admin()) with check (task_id is null or public.batipro_can_access_field_task(task_id) or public.batipro_is_admin());

drop policy if exists photo_requirements_select on public.photo_requirements;
create policy photo_requirements_select on public.photo_requirements for select to authenticated using (public.batipro_can_access_field_task(task_id));
drop policy if exists photo_requirements_write on public.photo_requirements;
create policy photo_requirements_write on public.photo_requirements for all to authenticated using (public.batipro_is_admin()) with check (public.batipro_is_admin());

drop policy if exists doe_requirements_select on public.doe_requirements;
create policy doe_requirements_select on public.doe_requirements for select to authenticated using (task_id is null or public.batipro_can_access_field_task(task_id) or public.batipro_is_admin());
drop policy if exists doe_requirements_write on public.doe_requirements;
create policy doe_requirements_write on public.doe_requirements for all to authenticated using (public.batipro_is_admin()) with check (public.batipro_is_admin());

drop policy if exists knowledge_improvements_admin on public.knowledge_improvements;
create policy knowledge_improvements_admin on public.knowledge_improvements for all to authenticated using (public.batipro_is_admin()) with check (public.batipro_is_admin());

grant select, insert, update, delete on public.field_execution_logs to authenticated;
grant select, insert, update, delete on public.field_feedback to authenticated;
grant select, insert, update, delete on public.photo_requirements to authenticated;
grant select, insert, update, delete on public.doe_requirements to authenticated;
grant select, insert, update, delete on public.knowledge_improvements to authenticated;
grant execute on function public.batipro_is_admin() to authenticated;
grant execute on function public.batipro_can_access_field_task(uuid) to authenticated;
