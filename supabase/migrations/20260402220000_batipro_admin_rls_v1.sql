create or replace function public.batipro_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'ADMIN'
  );
$$;

revoke all on function public.batipro_is_admin() from public;
grant execute on function public.batipro_is_admin() to authenticated;

do $$
begin
  if to_regclass('public.chantier_zones') is not null then
    drop policy if exists chantier_zones_auth_all on public.chantier_zones;
    drop policy if exists chantier_zones_admin_all on public.chantier_zones;
    create policy chantier_zones_admin_all
      on public.chantier_zones
      for all
      to authenticated
      using (public.batipro_is_admin())
      with check (public.batipro_is_admin());
  end if;

  if to_regclass('public.chantier_preparation_checklists') is not null then
    drop policy if exists chantier_preparation_checklists_auth_all on public.chantier_preparation_checklists;
    drop policy if exists chantier_preparation_checklists_admin_all on public.chantier_preparation_checklists;
    create policy chantier_preparation_checklists_admin_all
      on public.chantier_preparation_checklists
      for all
      to authenticated
      using (public.batipro_is_admin())
      with check (public.batipro_is_admin());
  end if;

  if to_regclass('public.chantier_photos') is not null then
    drop policy if exists chantier_photos_auth_all on public.chantier_photos;
    drop policy if exists chantier_photos_admin_all on public.chantier_photos;
    create policy chantier_photos_admin_all
      on public.chantier_photos
      for all
      to authenticated
      using (public.batipro_is_admin())
      with check (public.batipro_is_admin());
  end if;

  if to_regclass('public.chantier_change_orders') is not null then
    drop policy if exists chantier_change_orders_auth_all on public.chantier_change_orders;
    drop policy if exists chantier_change_orders_admin_all on public.chantier_change_orders;
    create policy chantier_change_orders_admin_all
      on public.chantier_change_orders
      for all
      to authenticated
      using (public.batipro_is_admin())
      with check (public.batipro_is_admin());
  end if;
end $$;

drop function if exists public.chantier_activity_log_insert(uuid, text, text, uuid, text, jsonb, text);
create or replace function public.chantier_activity_log_insert(
  p_chantier_id uuid,
  p_action_type text,
  p_entity_type text,
  p_entity_id uuid default null,
  p_reason text default null,
  p_changes jsonb default '{}'::jsonb,
  p_actor_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_actor_name text;
begin
  if auth.uid() is null or not public.batipro_is_admin() then
    raise exception 'forbidden';
  end if;

  if p_chantier_id is null then
    raise exception 'chantier_id_required';
  end if;

  v_actor_name := nullif(btrim(coalesce(p_actor_name, '')), '');
  if v_actor_name is null then
    v_actor_name := nullif(btrim(coalesce(auth.jwt() ->> 'email', '')), '');
  end if;

  insert into public.chantier_activity_log (
    chantier_id,
    actor_id,
    actor_name,
    actor_role,
    action_type,
    entity_type,
    entity_id,
    reason,
    changes
  ) values (
    p_chantier_id,
    auth.uid(),
    v_actor_name,
    nullif(btrim(coalesce(auth.jwt() ->> 'role', '')), ''),
    coalesce(nullif(btrim(coalesce(p_action_type, '')), ''), 'updated'),
    coalesce(nullif(btrim(coalesce(p_entity_type, '')), ''), 'chantier'),
    p_entity_id,
    nullif(btrim(coalesce(p_reason, '')), ''),
    coalesce(p_changes, '{}'::jsonb)
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.chantier_activity_log_insert(uuid, text, text, uuid, text, jsonb, text) from public;
grant execute on function public.chantier_activity_log_insert(uuid, text, text, uuid, text, jsonb, text) to authenticated;

do $$
begin
  if to_regclass('public.chantier_purchase_requests') is not null then
    drop policy if exists chantier_purchase_requests_auth_all on public.chantier_purchase_requests;
    drop policy if exists chantier_purchase_requests_admin_all on public.chantier_purchase_requests;
    create policy chantier_purchase_requests_admin_all
      on public.chantier_purchase_requests
      for all
      to authenticated
      using (public.batipro_is_admin())
      with check (public.batipro_is_admin());
  end if;

  if to_regclass('public.chantier_task_steps') is not null then
    drop policy if exists chantier_task_steps_auth_all on public.chantier_task_steps;
    drop policy if exists chantier_task_steps_admin_all on public.chantier_task_steps;
    create policy chantier_task_steps_admin_all
      on public.chantier_task_steps
      for all
      to authenticated
      using (public.batipro_is_admin())
      with check (public.batipro_is_admin());
  end if;

  if to_regclass('public.chantier_templates') is not null then
    drop policy if exists chantier_templates_auth_all on public.chantier_templates;
    drop policy if exists chantier_templates_admin_all on public.chantier_templates;
    create policy chantier_templates_admin_all
      on public.chantier_templates
      for all
      to authenticated
      using (public.batipro_is_admin())
      with check (public.batipro_is_admin());
  end if;

  if to_regclass('public.chantier_budget_settings') is not null then
    drop policy if exists chantier_budget_settings_auth_all on public.chantier_budget_settings;
    drop policy if exists chantier_budget_settings_admin_all on public.chantier_budget_settings;
    create policy chantier_budget_settings_admin_all
      on public.chantier_budget_settings
      for all
      to authenticated
      using (public.batipro_is_admin())
      with check (public.batipro_is_admin());
  end if;
end $$;

do $$
begin
  if to_regclass('public.chantier_activity_log') is not null then
    drop policy if exists chantier_activity_log_auth_select on public.chantier_activity_log;
    drop policy if exists chantier_activity_log_admin_select on public.chantier_activity_log;
    create policy chantier_activity_log_admin_select
      on public.chantier_activity_log
      for select
      to authenticated
      using (public.batipro_is_admin());
  end if;
end $$;
