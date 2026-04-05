create table if not exists public.chantier_task_zones (
  task_id uuid not null references public.chantier_tasks(id) on delete cascade,
  zone_id uuid not null references public.chantier_zones(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (task_id, zone_id)
);

create index if not exists chantier_task_zones_zone_idx
  on public.chantier_task_zones (zone_id, created_at desc);

create index if not exists chantier_task_zones_task_idx
  on public.chantier_task_zones (task_id, created_at desc);

alter table public.chantier_task_zones enable row level security;

drop policy if exists chantier_task_zones_admin_all on public.chantier_task_zones;
create policy chantier_task_zones_admin_all
  on public.chantier_task_zones
  for all
  to authenticated
  using (public.batipro_is_admin())
  with check (public.batipro_is_admin());

insert into public.chantier_task_zones (task_id, zone_id)
select distinct
  task_zone_links.task_id,
  task_zone_links.zone_id
from (
  select
    t.id as task_id,
    case
      when z.zone_type = 'piece' then z.id
      else dz.id
    end as zone_id
  from public.chantier_tasks t
  join public.chantier_zones z on z.id = t.zone_id
  left join lateral (
    with recursive descendants as (
      select cz.id, cz.parent_zone_id, cz.zone_type
      from public.chantier_zones cz
      where cz.id = z.id
      union all
      select child.id, child.parent_zone_id, child.zone_type
      from public.chantier_zones child
      join descendants d on child.parent_zone_id = d.id
    )
    select descendants.id
    from descendants
    where descendants.zone_type = 'piece'
  ) dz on z.zone_type <> 'piece'
  where t.zone_id is not null
) as task_zone_links
where task_zone_links.zone_id is not null
on conflict do nothing;
