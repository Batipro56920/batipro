create table if not exists public.intervenant_daily_checklists (
  id uuid primary key default gen_random_uuid(),
  intervenant_id uuid not null references public.intervenants(id) on delete cascade,
  chantier_id uuid references public.chantiers(id) on delete set null,
  checklist_date date not null,
  photos_taken boolean,
  tasks_reported boolean,
  time_logged boolean,
  has_equipment boolean,
  has_materials boolean,
  has_information boolean,
  validated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint intervenant_daily_checklists_intervenant_date_key unique (intervenant_id, checklist_date)
);

create index if not exists intervenant_daily_checklists_date_idx
  on public.intervenant_daily_checklists(checklist_date desc);

create index if not exists intervenant_daily_checklists_chantier_idx
  on public.intervenant_daily_checklists(chantier_id, checklist_date desc);

alter table public.intervenant_daily_checklists enable row level security;

drop trigger if exists trg_intervenant_daily_checklists_updated_at on public.intervenant_daily_checklists;
create trigger trg_intervenant_daily_checklists_updated_at
before update on public.intervenant_daily_checklists
for each row execute function public.set_updated_at();

create table if not exists public.intervenant_information_requests (
  id uuid primary key default gen_random_uuid(),
  chantier_id uuid not null references public.chantiers(id) on delete cascade,
  intervenant_id uuid not null references public.intervenants(id) on delete cascade,
  request_date date not null default current_date,
  subject text not null,
  message text not null,
  status text not null default 'envoyee',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint intervenant_information_requests_status_chk
    check (status in ('envoyee', 'traitee'))
);

create index if not exists intervenant_information_requests_chantier_idx
  on public.intervenant_information_requests(chantier_id, created_at desc);

create index if not exists intervenant_information_requests_intervenant_idx
  on public.intervenant_information_requests(intervenant_id, created_at desc);

alter table public.intervenant_information_requests enable row level security;

drop trigger if exists trg_intervenant_information_requests_updated_at on public.intervenant_information_requests;
create trigger trg_intervenant_information_requests_updated_at
before update on public.intervenant_information_requests
for each row execute function public.set_updated_at();

drop function if exists public.intervenant_daily_checklist_get(text, date);
create or replace function public.intervenant_daily_checklist_get(
  p_token text,
  p_checklist_date date default current_date
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ctx record;
  v_row public.intervenant_daily_checklists%rowtype;
  v_checklist_date date;
begin
  select *
  into v_ctx
  from public._intervenant_token_context_v2(p_token)
  limit 1;

  if v_ctx.intervenant_id is null then
    raise exception 'intervenant_required';
  end if;

  v_checklist_date := coalesce(p_checklist_date, current_date);

  select *
  into v_row
  from public.intervenant_daily_checklists
  where intervenant_id = v_ctx.intervenant_id
    and checklist_date = v_checklist_date
  limit 1;

  return jsonb_build_object(
    'id', v_row.id,
    'intervenant_id', v_ctx.intervenant_id,
    'chantier_id', coalesce(v_row.chantier_id, v_ctx.default_chantier_id),
    'checklist_date', v_checklist_date,
    'photos_taken', v_row.photos_taken,
    'tasks_reported', v_row.tasks_reported,
    'time_logged', v_row.time_logged,
    'has_equipment', v_row.has_equipment,
    'has_materials', v_row.has_materials,
    'has_information', v_row.has_information,
    'validated_at', v_row.validated_at,
    'created_at', v_row.created_at,
    'updated_at', v_row.updated_at
  );
end;
$$;

revoke all on function public.intervenant_daily_checklist_get(text, date) from public;
grant execute on function public.intervenant_daily_checklist_get(text, date) to anon, authenticated;

drop function if exists public.intervenant_daily_checklist_upsert(text, jsonb);
create or replace function public.intervenant_daily_checklist_upsert(
  p_token text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ctx record;
  v_existing public.intervenant_daily_checklists%rowtype;
  v_saved public.intervenant_daily_checklists%rowtype;
  v_checklist_date date;
  v_chantier_id uuid;
  v_validate boolean;
begin
  select *
  into v_ctx
  from public._intervenant_token_context_v2(p_token)
  limit 1;

  if v_ctx.intervenant_id is null then
    raise exception 'intervenant_required';
  end if;

  v_checklist_date := coalesce(
    nullif(btrim(coalesce(p_payload ->> 'checklist_date', '')), '')::date,
    current_date
  );

  v_chantier_id := nullif(btrim(coalesce(p_payload ->> 'chantier_id', '')), '')::uuid;
  if v_chantier_id is null then
    v_chantier_id := v_ctx.default_chantier_id;
  else
    perform public._intervenant_assert_chantier_access(p_token, v_chantier_id);
  end if;

  select *
  into v_existing
  from public.intervenant_daily_checklists
  where intervenant_id = v_ctx.intervenant_id
    and checklist_date = v_checklist_date
  limit 1;

  v_validate := coalesce((p_payload ->> 'validate')::boolean, false);

  insert into public.intervenant_daily_checklists (
    intervenant_id,
    chantier_id,
    checklist_date,
    photos_taken,
    tasks_reported,
    time_logged,
    has_equipment,
    has_materials,
    has_information,
    validated_at
  ) values (
    v_ctx.intervenant_id,
    v_chantier_id,
    v_checklist_date,
    coalesce((p_payload ->> 'photos_taken')::boolean, v_existing.photos_taken),
    coalesce((p_payload ->> 'tasks_reported')::boolean, v_existing.tasks_reported),
    coalesce((p_payload ->> 'time_logged')::boolean, v_existing.time_logged),
    coalesce((p_payload ->> 'has_equipment')::boolean, v_existing.has_equipment),
    coalesce((p_payload ->> 'has_materials')::boolean, v_existing.has_materials),
    coalesce((p_payload ->> 'has_information')::boolean, v_existing.has_information),
    case when v_validate then now() else v_existing.validated_at end
  )
  on conflict (intervenant_id, checklist_date)
  do update set
    chantier_id = excluded.chantier_id,
    photos_taken = excluded.photos_taken,
    tasks_reported = excluded.tasks_reported,
    time_logged = excluded.time_logged,
    has_equipment = excluded.has_equipment,
    has_materials = excluded.has_materials,
    has_information = excluded.has_information,
    validated_at = coalesce(excluded.validated_at, public.intervenant_daily_checklists.validated_at)
  returning * into v_saved;

  return jsonb_build_object(
    'id', v_saved.id,
    'intervenant_id', v_saved.intervenant_id,
    'chantier_id', v_saved.chantier_id,
    'checklist_date', v_saved.checklist_date,
    'photos_taken', v_saved.photos_taken,
    'tasks_reported', v_saved.tasks_reported,
    'time_logged', v_saved.time_logged,
    'has_equipment', v_saved.has_equipment,
    'has_materials', v_saved.has_materials,
    'has_information', v_saved.has_information,
    'validated_at', v_saved.validated_at,
    'created_at', v_saved.created_at,
    'updated_at', v_saved.updated_at
  );
end;
$$;

revoke all on function public.intervenant_daily_checklist_upsert(text, jsonb) from public;
grant execute on function public.intervenant_daily_checklist_upsert(text, jsonb) to anon, authenticated;

drop function if exists public.intervenant_information_request_create(text, jsonb);
create or replace function public.intervenant_information_request_create(
  p_token text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_chantier_id uuid;
  v_intervenant_id uuid;
  v_subject text;
  v_message text;
  v_request_date date;
  v_id uuid;
begin
  v_chantier_id := nullif(btrim(coalesce(p_payload ->> 'chantier_id', '')), '')::uuid;
  if v_chantier_id is null then
    raise exception 'chantier_id_required';
  end if;

  v_intervenant_id := public._intervenant_assert_chantier_access(p_token, v_chantier_id);
  if v_intervenant_id is null then
    raise exception 'intervenant_required';
  end if;

  v_subject := nullif(btrim(coalesce(p_payload ->> 'subject', '')), '');
  if v_subject is null then
    raise exception 'subject_required';
  end if;

  v_message := nullif(btrim(coalesce(p_payload ->> 'message', '')), '');
  if v_message is null then
    raise exception 'message_required';
  end if;

  v_request_date := coalesce(
    nullif(btrim(coalesce(p_payload ->> 'request_date', '')), '')::date,
    current_date
  );

  insert into public.intervenant_information_requests (
    chantier_id,
    intervenant_id,
    request_date,
    subject,
    message
  ) values (
    v_chantier_id,
    v_intervenant_id,
    v_request_date,
    v_subject,
    v_message
  )
  returning id into v_id;

  return jsonb_build_object(
    'id', v_id,
    'chantier_id', v_chantier_id,
    'intervenant_id', v_intervenant_id,
    'request_date', v_request_date,
    'subject', v_subject,
    'message', v_message,
    'status', 'envoyee'
  );
end;
$$;

revoke all on function public.intervenant_information_request_create(text, jsonb) from public;
grant execute on function public.intervenant_information_request_create(text, jsonb) to anon, authenticated;

drop function if exists public.intervenant_information_request_list(text, uuid);
create or replace function public.intervenant_information_request_list(
  p_token text,
  p_chantier_id uuid
)
returns table (
  id uuid,
  chantier_id uuid,
  intervenant_id uuid,
  request_date date,
  subject text,
  message text,
  status text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_intervenant_id uuid;
begin
  v_intervenant_id := public._intervenant_assert_chantier_access(p_token, p_chantier_id);

  return query
  select
    req.id,
    req.chantier_id,
    req.intervenant_id,
    req.request_date,
    req.subject,
    req.message,
    req.status,
    req.created_at,
    req.updated_at
  from public.intervenant_information_requests req
  where req.chantier_id = p_chantier_id
    and req.intervenant_id = v_intervenant_id
  order by req.created_at desc;
end;
$$;

revoke all on function public.intervenant_information_request_list(text, uuid) from public;
grant execute on function public.intervenant_information_request_list(text, uuid) to anon, authenticated;
