do $$
begin
  if to_regclass('public.intervenant_information_requests') is not null then
    alter table public.intervenant_information_requests
      add column if not exists admin_reply text null,
      add column if not exists admin_replied_by uuid null,
      add column if not exists admin_replied_at timestamptz null;
  end if;
end $$;

create index if not exists intervenant_information_requests_status_idx
  on public.intervenant_information_requests(chantier_id, status, created_at desc);

drop policy if exists intervenant_information_requests_admin_all on public.intervenant_information_requests;
create policy intervenant_information_requests_admin_all
  on public.intervenant_information_requests
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
  admin_reply text,
  admin_replied_by uuid,
  admin_replied_at timestamptz,
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
    req.admin_reply,
    req.admin_replied_by,
    req.admin_replied_at,
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
