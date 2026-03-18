-- Task progress admin override + document permissions for intervenant portal

alter table if exists public.chantier_tasks
  add column if not exists progress_override_percent numeric null,
  add column if not exists progress_override_updated_at timestamptz null,
  add column if not exists progress_override_updated_by uuid null;

do $$
begin
  if to_regclass('public.chantier_tasks') is not null
     and exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'chantier_tasks'
         and column_name = 'avancement_override_percent'
     ) then
    execute $sql$
      update public.chantier_tasks
      set progress_override_percent = avancement_override_percent
      where progress_override_percent is null
        and avancement_override_percent is not null
    $sql$;
  end if;
end $$;

do $$
begin
  if to_regclass('public.chantier_tasks') is not null
     and not exists (
       select 1
       from pg_constraint
       where conrelid = 'public.chantier_tasks'::regclass
         and conname = 'chantier_tasks_progress_override_percent_chk'
     ) then
    alter table public.chantier_tasks
      add constraint chantier_tasks_progress_override_percent_chk
      check (
        progress_override_percent is null
        or (progress_override_percent >= 0 and progress_override_percent <= 100)
      );
  end if;
end $$;

do $$
begin
  if to_regclass('public.chantier_tasks') is not null
     and not exists (
       select 1
       from pg_constraint
       where conrelid = 'public.chantier_tasks'::regclass
         and conname = 'chantier_tasks_progress_override_updated_by_fkey'
     ) then
    alter table public.chantier_tasks
      add constraint chantier_tasks_progress_override_updated_by_fkey
      foreign key (progress_override_updated_by)
      references auth.users(id)
      on delete set null;
  end if;
end $$;

create table if not exists public.document_permissions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.chantier_documents(id) on delete cascade,
  intervenant_id uuid not null references public.intervenants(id) on delete cascade,
  chantier_id uuid not null references public.chantiers(id) on delete cascade,
  created_at timestamptz not null default now()
);

create unique index if not exists document_permissions_document_intervenant_uniq
  on public.document_permissions(document_id, intervenant_id);

create index if not exists document_permissions_chantier_idx
  on public.document_permissions(chantier_id);

create index if not exists document_permissions_document_idx
  on public.document_permissions(document_id);

create index if not exists document_permissions_intervenant_idx
  on public.document_permissions(intervenant_id);

do $$
begin
  if to_regclass('public.document_access') is not null then
    insert into public.document_permissions (document_id, intervenant_id, chantier_id)
    select
      da.document_id,
      da.intervenant_id,
      d.chantier_id
    from public.document_access da
    join public.chantier_documents d
      on d.id = da.document_id
    on conflict (document_id, intervenant_id) do update
      set chantier_id = excluded.chantier_id;
  end if;
end $$;

alter table if exists public.document_permissions enable row level security;

drop policy if exists document_permissions_admin_all on public.document_permissions;
create policy document_permissions_admin_all
  on public.document_permissions
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'ADMIN'
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'ADMIN'
    )
  );

drop function if exists public.admin_set_task_progress_override(uuid, numeric);
create or replace function public.admin_set_task_progress_override(
  p_task_id uuid,
  p_progress numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_progress numeric;
  v_has_legacy_override boolean;
  v_task record;
begin
  if auth.uid() is null then
    raise exception 'forbidden';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'ADMIN'
  ) then
    raise exception 'forbidden';
  end if;

  if p_task_id is null then
    raise exception 'task_id_required';
  end if;

  v_progress := case
    when p_progress is null then null
    else greatest(0, least(100, p_progress))
  end;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'chantier_tasks'
      and column_name = 'avancement_override_percent'
  ) into v_has_legacy_override;

  if v_has_legacy_override then
    update public.chantier_tasks
    set
      progress_override_percent = v_progress,
      avancement_override_percent = v_progress,
      progress_override_updated_at = now(),
      progress_override_updated_by = auth.uid(),
      updated_at = now()
    where id = p_task_id
    returning
      id,
      chantier_id,
      progress_override_percent,
      progress_override_updated_at,
      progress_override_updated_by
    into v_task;
  else
    update public.chantier_tasks
    set
      progress_override_percent = v_progress,
      progress_override_updated_at = now(),
      progress_override_updated_by = auth.uid(),
      updated_at = now()
    where id = p_task_id
    returning
      id,
      chantier_id,
      progress_override_percent,
      progress_override_updated_at,
      progress_override_updated_by
    into v_task;
  end if;

  if v_task is null then
    raise exception 'task_not_found';
  end if;

  return jsonb_build_object(
    'id', v_task.id,
    'chantier_id', v_task.chantier_id,
    'progress_override_percent', v_task.progress_override_percent,
    'progress_override_updated_at', v_task.progress_override_updated_at,
    'progress_override_updated_by', v_task.progress_override_updated_by
  );
end;
$$;

drop function if exists public.admin_set_task_document_permissions(uuid, uuid[], uuid[]);
create or replace function public.admin_set_task_document_permissions(
  p_task_id uuid,
  p_document_ids uuid[],
  p_intervenant_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_chantier_id uuid;
  v_document_ids uuid[] := '{}'::uuid[];
  v_intervenant_ids uuid[] := '{}'::uuid[];
  v_previous_document_ids uuid[] := '{}'::uuid[];
  v_scope_document_ids uuid[] := '{}'::uuid[];
  v_has_document_access boolean;
  v_linked_count integer := 0;
  v_permission_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'forbidden';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'ADMIN'
  ) then
    raise exception 'forbidden';
  end if;

  if p_task_id is null then
    raise exception 'task_id_required';
  end if;

  select t.chantier_id
  into v_chantier_id
  from public.chantier_tasks t
  where t.id = p_task_id;

  if v_chantier_id is null then
    raise exception 'task_not_found';
  end if;

  select coalesce(array_agg(distinct td.document_id), '{}'::uuid[])
  into v_previous_document_ids
  from public.task_documents td
  where td.task_id = p_task_id;

  select coalesce(array_agg(distinct d), '{}'::uuid[])
  into v_document_ids
  from unnest(coalesce(p_document_ids, '{}'::uuid[])) as d
  where d is not null;

  select coalesce(array_agg(distinct i), '{}'::uuid[])
  into v_intervenant_ids
  from unnest(coalesce(p_intervenant_ids, '{}'::uuid[])) as i
  where i is not null;

  if exists (
    select 1
    from unnest(v_document_ids) as doc_id
    join public.chantier_documents d on d.id = doc_id
    where d.chantier_id <> v_chantier_id
  ) then
    raise exception 'document_out_of_scope';
  end if;

  delete from public.task_documents td
  where td.task_id = p_task_id
    and not (td.document_id = any(v_document_ids));

  if coalesce(array_length(v_document_ids, 1), 0) > 0 then
    insert into public.task_documents (task_id, document_id)
    select p_task_id, doc_id
    from unnest(v_document_ids) as doc_id
    where not exists (
      select 1
      from public.task_documents td
      where td.task_id = p_task_id
        and td.document_id = doc_id
    );
  end if;

  select count(*)::int
  into v_linked_count
  from public.task_documents td
  where td.task_id = p_task_id;

  select coalesce(array_agg(distinct x), '{}'::uuid[])
  into v_scope_document_ids
  from (
    select unnest(v_previous_document_ids) as x
    union
    select unnest(v_document_ids) as x
  ) s;

  if coalesce(array_length(v_scope_document_ids, 1), 0) > 0 then
    delete from public.document_permissions dp
    where dp.chantier_id = v_chantier_id
      and dp.document_id = any(v_scope_document_ids)
      and not (dp.intervenant_id = any(v_intervenant_ids));
  end if;

  if coalesce(array_length(v_document_ids, 1), 0) > 0
     and coalesce(array_length(v_intervenant_ids, 1), 0) > 0 then
    insert into public.document_permissions (document_id, intervenant_id, chantier_id)
    select doc_id, intervenant_id, v_chantier_id
    from unnest(v_document_ids) as doc_id
    cross join unnest(v_intervenant_ids) as intervenant_id
    on conflict (document_id, intervenant_id) do update
      set chantier_id = excluded.chantier_id;
  end if;

  select count(*)::int
  into v_permission_count
  from public.document_permissions dp
  where dp.chantier_id = v_chantier_id
    and (coalesce(array_length(v_document_ids, 1), 0) = 0 or dp.document_id = any(v_document_ids));

  v_has_document_access := to_regclass('public.document_access') is not null;
  if v_has_document_access and coalesce(array_length(v_scope_document_ids, 1), 0) > 0 then
    execute $sql$
      delete from public.document_access da
      where da.document_id = any($1)
        and not (da.intervenant_id = any($2))
    $sql$ using v_scope_document_ids, v_intervenant_ids;

    if coalesce(array_length(v_document_ids, 1), 0) > 0
       and coalesce(array_length(v_intervenant_ids, 1), 0) > 0 then
      execute $sql$
        insert into public.document_access (document_id, intervenant_id)
        select doc_id, intervenant_id
        from unnest($1) as doc_id
        cross join unnest($2) as intervenant_id
        on conflict do nothing
      $sql$ using v_document_ids, v_intervenant_ids;
    end if;
  end if;

  return jsonb_build_object(
    'task_id', p_task_id,
    'linked_documents', v_linked_count,
    'permission_rows', v_permission_count
  );
end;
$$;

drop function if exists public.intervenant_get_documents(text, uuid);
create or replace function public.intervenant_get_documents(
  p_token text,
  p_chantier_id uuid
)
returns table (
  id uuid,
  chantier_id uuid,
  title text,
  file_name text,
  category text,
  document_type text,
  visibility_mode text,
  visibility text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_intervenant_id uuid;
  v_has_document_permissions boolean;
  v_has_document_access boolean;
begin
  v_intervenant_id := public._intervenant_assert_chantier_access(p_token, p_chantier_id);
  v_has_document_permissions := to_regclass('public.document_permissions') is not null;
  v_has_document_access := to_regclass('public.document_access') is not null;

  return query
  select
    d.id,
    d.chantier_id,
    d.title,
    d.file_name,
    d.category,
    d.document_type,
    d.visibility_mode,
    d.visibility,
    d.created_at
  from public.chantier_documents d
  where d.chantier_id = p_chantier_id
    and coalesce(upper(d.visibility), 'INTERVENANT') <> 'ADMIN'
    and (
      (
        exists (
          select 1
          from public.task_documents td
          join public.chantier_tasks t
            on t.id = td.task_id
          where td.document_id = d.id
            and t.chantier_id = p_chantier_id
            and (
              t.intervenant_id = v_intervenant_id
              or exists (
                select 1
                from public.chantier_task_assignees cta
                where cta.task_id = t.id
                  and cta.intervenant_id = v_intervenant_id
              )
            )
        )
      )
      or (
        not exists (
          select 1
          from public.task_documents td_any
          join public.chantier_tasks t_any
            on t_any.id = td_any.task_id
          where td_any.document_id = d.id
            and t_any.chantier_id = p_chantier_id
        )
      )
    )
    and (
      (coalesce(upper(d.visibility_mode), '') = 'GLOBAL' and coalesce(upper(d.visibility), '') <> 'ADMIN')
      or (
        v_has_document_permissions
        and exists (
          select 1
          from public.document_permissions dp
          where dp.document_id = d.id
            and dp.chantier_id = p_chantier_id
            and dp.intervenant_id = v_intervenant_id
        )
      )
      or (
        not v_has_document_permissions
        and v_has_document_access
        and exists (
          select 1
          from public.document_access da
          where da.document_id = d.id
            and da.intervenant_id = v_intervenant_id
        )
      )
    )
  order by d.created_at desc;
end;
$$;

revoke all on function public.admin_set_task_progress_override(uuid, numeric) from public;
revoke all on function public.admin_set_task_document_permissions(uuid, uuid[], uuid[]) from public;
revoke all on function public.intervenant_get_documents(text, uuid) from public;

grant execute on function public.admin_set_task_progress_override(uuid, numeric) to authenticated;
grant execute on function public.admin_set_task_document_permissions(uuid, uuid[], uuid[]) to authenticated;
grant execute on function public.intervenant_get_documents(text, uuid) to anon, authenticated;

grant select, insert, update, delete on table public.document_permissions to authenticated;
