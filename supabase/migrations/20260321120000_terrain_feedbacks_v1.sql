create table if not exists public.terrain_feedbacks (
  id uuid primary key default gen_random_uuid(),
  chantier_id uuid not null references public.chantiers(id) on delete cascade,
  author_intervenant_id uuid not null references public.intervenants(id) on delete cascade,
  category text not null,
  urgency text not null default 'normale',
  title text not null,
  description text not null,
  status text not null default 'nouveau',
  assigned_to uuid null,
  assigned_to_name text null,
  treatment_comment text null,
  treated_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint terrain_feedbacks_category_chk check (
    category in (
      'observation_chantier',
      'anomalie',
      'blocage',
      'suggestion',
      'qualite',
      'securite',
      'client',
      'organisation'
    )
  ),
  constraint terrain_feedbacks_urgency_chk check (urgency in ('faible', 'normale', 'urgente', 'critique')),
  constraint terrain_feedbacks_status_chk check (status in ('nouveau', 'en_cours', 'traite', 'classe_sans_suite'))
);

create index if not exists terrain_feedbacks_chantier_idx
  on public.terrain_feedbacks(chantier_id, created_at desc);

create index if not exists terrain_feedbacks_author_idx
  on public.terrain_feedbacks(author_intervenant_id, created_at desc);

create index if not exists terrain_feedbacks_status_idx
  on public.terrain_feedbacks(status, created_at desc);

create index if not exists terrain_feedbacks_category_idx
  on public.terrain_feedbacks(category, created_at desc);

alter table public.terrain_feedbacks enable row level security;

do $$
begin
  if exists (
    select 1
    from pg_proc
    where proname = 'set_updated_at'
  ) then
    drop trigger if exists trg_terrain_feedbacks_updated_at on public.terrain_feedbacks;
    create trigger trg_terrain_feedbacks_updated_at
    before update on public.terrain_feedbacks
    for each row execute function public.set_updated_at();
  end if;
end $$;

create table if not exists public.terrain_feedback_attachments (
  id uuid primary key default gen_random_uuid(),
  feedback_id uuid not null references public.terrain_feedbacks(id) on delete cascade,
  storage_bucket text not null default 'terrain-feedbacks',
  storage_path text not null,
  file_name text not null,
  mime_type text null,
  size_bytes bigint null,
  created_at timestamptz not null default now()
);

create index if not exists terrain_feedback_attachments_feedback_idx
  on public.terrain_feedback_attachments(feedback_id, created_at asc);

alter table public.terrain_feedback_attachments enable row level security;

create table if not exists public.terrain_feedback_history (
  id uuid primary key default gen_random_uuid(),
  feedback_id uuid not null references public.terrain_feedbacks(id) on delete cascade,
  changed_by uuid null,
  changed_by_name text null,
  action text not null,
  changes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists terrain_feedback_history_feedback_idx
  on public.terrain_feedback_history(feedback_id, created_at desc);

alter table public.terrain_feedback_history enable row level security;

drop function if exists public._terrain_feedback_is_admin();
create or replace function public._terrain_feedback_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'ADMIN'
  );
$$;

revoke all on function public._terrain_feedback_is_admin() from public;

drop policy if exists terrain_feedbacks_admin_all on public.terrain_feedbacks;
create policy terrain_feedbacks_admin_all
  on public.terrain_feedbacks
  for all
  to authenticated
  using (public._terrain_feedback_is_admin())
  with check (public._terrain_feedback_is_admin());

drop policy if exists terrain_feedback_attachments_admin_all on public.terrain_feedback_attachments;
create policy terrain_feedback_attachments_admin_all
  on public.terrain_feedback_attachments
  for all
  to authenticated
  using (public._terrain_feedback_is_admin())
  with check (public._terrain_feedback_is_admin());

drop policy if exists terrain_feedback_history_admin_all on public.terrain_feedback_history;
create policy terrain_feedback_history_admin_all
  on public.terrain_feedback_history
  for all
  to authenticated
  using (public._terrain_feedback_is_admin())
  with check (public._terrain_feedback_is_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'terrain-feedbacks',
  'terrain-feedbacks',
  true,
  20971520,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop function if exists public._terrain_feedback_normalize_category(text);
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
    else null
  end;
$$;

drop function if exists public._terrain_feedback_normalize_urgency(text);
create or replace function public._terrain_feedback_normalize_urgency(p_value text)
returns text
language sql
immutable
as $$
  select case lower(regexp_replace(coalesce(p_value, ''), '\s+', '_', 'g'))
    when 'faible' then 'faible'
    when 'basse' then 'faible'
    when 'normale' then 'normale'
    when 'normal' then 'normale'
    when 'moyenne' then 'normale'
    when 'urgente' then 'urgente'
    when 'haute' then 'urgente'
    when 'important' then 'urgente'
    when 'critique' then 'critique'
    else 'normale'
  end;
$$;

drop function if exists public._terrain_feedback_normalize_status(text);
create or replace function public._terrain_feedback_normalize_status(p_value text)
returns text
language sql
immutable
as $$
  select case lower(regexp_replace(coalesce(p_value, ''), '\s+', '_', 'g'))
    when 'nouveau' then 'nouveau'
    when 'new' then 'nouveau'
    when 'en_cours' then 'en_cours'
    when 'encours' then 'en_cours'
    when 'in_progress' then 'en_cours'
    when 'traite' then 'traite'
    when 'traité' then 'traite'
    when 'done' then 'traite'
    when 'classe_sans_suite' then 'classe_sans_suite'
    when 'classé_sans_suite' then 'classe_sans_suite'
    when 'closed_without_action' then 'classe_sans_suite'
    else 'nouveau'
  end;
$$;

drop function if exists public._terrain_feedback_history_insert(uuid, uuid, text, text, jsonb);
create or replace function public._terrain_feedback_history_insert(
  p_feedback_id uuid,
  p_changed_by uuid,
  p_changed_by_name text,
  p_action text,
  p_changes jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.terrain_feedback_history (
    feedback_id,
    changed_by,
    changed_by_name,
    action,
    changes
  ) values (
    p_feedback_id,
    p_changed_by,
    nullif(btrim(coalesce(p_changed_by_name, '')), ''),
    coalesce(nullif(btrim(coalesce(p_action, '')), ''), 'updated'),
    coalesce(p_changes, '{}'::jsonb)
  );
end;
$$;

revoke all on function public._terrain_feedback_history_insert(uuid, uuid, text, text, jsonb) from public;

drop function if exists public.intervenant_terrain_feedback_create(text, jsonb);
create or replace function public.intervenant_terrain_feedback_create(
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
  v_category text;
  v_urgency text;
  v_title text;
  v_description text;
  v_row public.terrain_feedbacks%rowtype;
begin
  v_chantier_id := nullif(btrim(coalesce(p_payload ->> 'chantier_id', '')), '')::uuid;
  if v_chantier_id is null then
    raise exception 'chantier_id_required';
  end if;

  v_intervenant_id := public._intervenant_assert_chantier_access(p_token, v_chantier_id);
  if v_intervenant_id is null then
    raise exception 'intervenant_required';
  end if;

  v_category := public._terrain_feedback_normalize_category(p_payload ->> 'category');
  if v_category is null then
    raise exception 'category_required';
  end if;

  v_urgency := public._terrain_feedback_normalize_urgency(p_payload ->> 'urgency');
  v_title := nullif(btrim(coalesce(p_payload ->> 'title', '')), '');
  if v_title is null then
    raise exception 'title_required';
  end if;

  v_description := nullif(btrim(coalesce(p_payload ->> 'description', '')), '');
  if v_description is null then
    raise exception 'description_required';
  end if;

  insert into public.terrain_feedbacks (
    chantier_id,
    author_intervenant_id,
    category,
    urgency,
    title,
    description
  ) values (
    v_chantier_id,
    v_intervenant_id,
    v_category,
    v_urgency,
    v_title,
    v_description
  )
  returning * into v_row;

  perform public._terrain_feedback_history_insert(
    v_row.id,
    null,
    'Portail intervenant',
    'created',
    jsonb_build_object(
      'status', v_row.status,
      'category', v_row.category,
      'urgency', v_row.urgency
    )
  );

  return jsonb_build_object(
    'id', v_row.id,
    'chantier_id', v_row.chantier_id,
    'author_intervenant_id', v_row.author_intervenant_id,
    'category', v_row.category,
    'urgency', v_row.urgency,
    'title', v_row.title,
    'description', v_row.description,
    'status', v_row.status,
    'assigned_to', v_row.assigned_to,
    'assigned_to_name', v_row.assigned_to_name,
    'treatment_comment', v_row.treatment_comment,
    'treated_at', v_row.treated_at,
    'created_at', v_row.created_at,
    'updated_at', v_row.updated_at,
    'attachments', '[]'::jsonb
  );
end;
$$;

revoke all on function public.intervenant_terrain_feedback_create(text, jsonb) from public;
grant execute on function public.intervenant_terrain_feedback_create(text, jsonb) to anon, authenticated;

drop function if exists public.intervenant_terrain_feedback_list(text, uuid);
create or replace function public.intervenant_terrain_feedback_list(
  p_token text,
  p_chantier_id uuid default null
)
returns table (
  id uuid,
  chantier_id uuid,
  chantier_nom text,
  author_intervenant_id uuid,
  category text,
  urgency text,
  title text,
  description text,
  status text,
  assigned_to uuid,
  assigned_to_name text,
  treatment_comment text,
  treated_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  attachments jsonb
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ctx record;
begin
  select *
  into v_ctx
  from public._intervenant_token_context_v2(p_token)
  limit 1;

  if v_ctx.intervenant_id is null then
    raise exception 'intervenant_required';
  end if;

  if p_chantier_id is not null then
    perform public._intervenant_assert_chantier_access(p_token, p_chantier_id);
  end if;

  return query
  select
    fb.id,
    fb.chantier_id,
    c.nom as chantier_nom,
    fb.author_intervenant_id,
    fb.category,
    fb.urgency,
    fb.title,
    fb.description,
    fb.status,
    fb.assigned_to,
    fb.assigned_to_name,
    fb.treatment_comment,
    fb.treated_at,
    fb.created_at,
    fb.updated_at,
    coalesce(att.attachments, '[]'::jsonb) as attachments
  from public.terrain_feedbacks fb
  join public.chantiers c on c.id = fb.chantier_id
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'id', a.id,
        'storage_bucket', a.storage_bucket,
        'storage_path', a.storage_path,
        'file_name', a.file_name,
        'mime_type', a.mime_type,
        'size_bytes', a.size_bytes,
        'created_at', a.created_at
      )
      order by a.created_at asc
    ) as attachments
    from public.terrain_feedback_attachments a
    where a.feedback_id = fb.id
  ) att on true
  where fb.author_intervenant_id = v_ctx.intervenant_id
    and (
      p_chantier_id is null
      and fb.chantier_id = any(v_ctx.chantier_ids)
      or p_chantier_id is not null
      and fb.chantier_id = p_chantier_id
    )
  order by fb.created_at desc;
end;
$$;

revoke all on function public.intervenant_terrain_feedback_list(text, uuid) from public;
grant execute on function public.intervenant_terrain_feedback_list(text, uuid) to anon, authenticated;

drop function if exists public.admin_terrain_feedback_update(uuid, jsonb);
create or replace function public.admin_terrain_feedback_update(
  p_id uuid,
  p_patch jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing public.terrain_feedbacks%rowtype;
  v_saved public.terrain_feedbacks%rowtype;
  v_status text;
  v_assigned_to uuid;
  v_assigned_to_name text;
  v_treatment_comment text;
  v_treated_at timestamptz;
  v_changed_by_name text;
  v_changes jsonb := '{}'::jsonb;
begin
  if not public._terrain_feedback_is_admin() then
    raise exception 'forbidden';
  end if;

  if p_id is null then
    raise exception 'id_required';
  end if;

  select *
  into v_existing
  from public.terrain_feedbacks
  where id = p_id
  limit 1;

  if v_existing.id is null then
    raise exception 'feedback_not_found';
  end if;

  v_changed_by_name := coalesce(nullif(btrim(coalesce(auth.jwt() ->> 'email', '')), ''), 'Admin');

  v_status := case
    when p_patch ? 'status' then public._terrain_feedback_normalize_status(p_patch ->> 'status')
    else v_existing.status
  end;

  v_assigned_to := case
    when p_patch ? 'assigned_to' then nullif(btrim(coalesce(p_patch ->> 'assigned_to', '')), '')::uuid
    else v_existing.assigned_to
  end;

  v_assigned_to_name := case
    when p_patch ? 'assigned_to_name' then nullif(btrim(coalesce(p_patch ->> 'assigned_to_name', '')), '')
    else v_existing.assigned_to_name
  end;

  v_treatment_comment := case
    when p_patch ? 'treatment_comment' then nullif(btrim(coalesce(p_patch ->> 'treatment_comment', '')), '')
    else v_existing.treatment_comment
  end;

  if p_patch ? 'treated_at' then
    v_treated_at := nullif(btrim(coalesce(p_patch ->> 'treated_at', '')), '')::timestamptz;
  elsif v_status in ('traite', 'classe_sans_suite') and v_existing.status not in ('traite', 'classe_sans_suite') then
    v_treated_at := now();
  elsif v_status in ('nouveau', 'en_cours') then
    v_treated_at := null;
  else
    v_treated_at := v_existing.treated_at;
  end if;

  if v_status is distinct from v_existing.status then
    v_changes := v_changes || jsonb_build_object('status', jsonb_build_object('from', v_existing.status, 'to', v_status));
  end if;
  if v_assigned_to is distinct from v_existing.assigned_to or v_assigned_to_name is distinct from v_existing.assigned_to_name then
    v_changes := v_changes || jsonb_build_object(
      'assigned_to',
      jsonb_build_object(
        'from', coalesce(v_existing.assigned_to_name, v_existing.assigned_to::text),
        'to', coalesce(v_assigned_to_name, v_assigned_to::text)
      )
    );
  end if;
  if v_treatment_comment is distinct from v_existing.treatment_comment then
    v_changes := v_changes || jsonb_build_object('treatment_comment', true);
  end if;
  if v_treated_at is distinct from v_existing.treated_at then
    v_changes := v_changes || jsonb_build_object('treated_at', jsonb_build_object('from', v_existing.treated_at, 'to', v_treated_at));
  end if;

  update public.terrain_feedbacks
  set
    status = v_status,
    assigned_to = v_assigned_to,
    assigned_to_name = v_assigned_to_name,
    treatment_comment = v_treatment_comment,
    treated_at = v_treated_at
  where id = p_id
  returning * into v_saved;

  perform public._terrain_feedback_history_insert(
    v_saved.id,
    auth.uid(),
    v_changed_by_name,
    'updated',
    v_changes
  );

  return jsonb_build_object(
    'id', v_saved.id,
    'chantier_id', v_saved.chantier_id,
    'author_intervenant_id', v_saved.author_intervenant_id,
    'category', v_saved.category,
    'urgency', v_saved.urgency,
    'title', v_saved.title,
    'description', v_saved.description,
    'status', v_saved.status,
    'assigned_to', v_saved.assigned_to,
    'assigned_to_name', v_saved.assigned_to_name,
    'treatment_comment', v_saved.treatment_comment,
    'treated_at', v_saved.treated_at,
    'created_at', v_saved.created_at,
    'updated_at', v_saved.updated_at
  );
end;
$$;

revoke all on function public.admin_terrain_feedback_update(uuid, jsonb) from public;
grant execute on function public.admin_terrain_feedback_update(uuid, jsonb) to authenticated;
