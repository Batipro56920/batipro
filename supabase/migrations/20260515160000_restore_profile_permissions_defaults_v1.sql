create or replace function public.batipro_has_feature_permission(p_key text)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'ADMIN'
      and case
        when coalesce(p_key, '') = '' then false
        when coalesce(p.feature_permissions, '{}'::jsonb) ? p_key
          then coalesce((p.feature_permissions ->> p_key)::boolean, false)
        else true
      end
  );
$$;

revoke all on function public.batipro_has_feature_permission(text) from public;
grant execute on function public.batipro_has_feature_permission(text) to authenticated;

create or replace function public.batipro_can_access_task_library_preparation()
returns boolean
language sql
stable
as $$
  select public.batipro_has_feature_permission('task_library_preparation');
$$;

revoke all on function public.batipro_can_access_task_library_preparation() from public;
grant execute on function public.batipro_can_access_task_library_preparation() to authenticated;
