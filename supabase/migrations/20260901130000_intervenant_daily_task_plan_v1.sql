-- Onglet "Matin" du portail ouvrier : "J'organise ma journée" — l'ouvrier
-- choisit lui-même quelles tâches il fait aujourd'hui et dans quel ordre,
-- même quand un planning existe déjà côté bureau. Mémorisé pour survivre à
-- une fermeture d'appli / changement d'appareil dans la même journée.
-- Remplacement complet à chaque sauvegarde (pas d'ajout/retrait incrémental
-- côté serveur) : le client renvoie toujours la liste ordonnée complète.

create table if not exists public.intervenant_daily_task_plans (
  id uuid primary key default gen_random_uuid(),
  intervenant_id uuid not null references public.intervenants(id) on delete cascade,
  chantier_id uuid not null references public.chantiers(id) on delete cascade,
  task_id uuid not null references public.chantier_tasks(id) on delete cascade,
  plan_date date not null default current_date,
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  constraint intervenant_daily_task_plans_unique_task_per_day
    unique (intervenant_id, chantier_id, plan_date, task_id)
);

create index if not exists intervenant_daily_task_plans_lookup_idx
  on public.intervenant_daily_task_plans(intervenant_id, chantier_id, plan_date, order_index);

alter table public.intervenant_daily_task_plans enable row level security;

drop policy if exists intervenant_daily_task_plans_backoffice_all on public.intervenant_daily_task_plans;
create policy intervenant_daily_task_plans_backoffice_all
  on public.intervenant_daily_task_plans
  for all
  to authenticated
  using (public.is_backoffice())
  with check (public.is_backoffice());

drop function if exists public.intervenant_daily_task_plan_get(text, uuid, date);
create function public.intervenant_daily_task_plan_get(
  p_token text,
  p_chantier_id uuid,
  p_plan_date date default current_date
)
returns table (
  task_id uuid,
  order_index integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_intervenant_id uuid;
begin
  v_intervenant_id := public._intervenant_assert_chantier_access(p_token, p_chantier_id);
  if v_intervenant_id is null then
    raise exception 'intervenant_required';
  end if;

  return query
  select p.task_id, p.order_index
  from public.intervenant_daily_task_plans p
  where p.intervenant_id = v_intervenant_id
    and p.chantier_id = p_chantier_id
    and p.plan_date = coalesce(p_plan_date, current_date)
  order by p.order_index;
end;
$$;

revoke all on function public.intervenant_daily_task_plan_get(text, uuid, date) from public;
grant execute on function public.intervenant_daily_task_plan_get(text, uuid, date) to anon, authenticated;

drop function if exists public.intervenant_daily_task_plan_set(text, uuid, date, uuid[]);
create function public.intervenant_daily_task_plan_set(
  p_token text,
  p_chantier_id uuid,
  p_plan_date date,
  p_task_ids uuid[]
)
returns table (
  task_id uuid,
  order_index integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_intervenant_id uuid;
  v_plan_date date;
begin
  v_intervenant_id := public._intervenant_assert_chantier_access(p_token, p_chantier_id);
  if v_intervenant_id is null then
    raise exception 'intervenant_required';
  end if;

  v_plan_date := coalesce(p_plan_date, current_date);

  delete from public.intervenant_daily_task_plans p
  where p.intervenant_id = v_intervenant_id
    and p.chantier_id = p_chantier_id
    and p.plan_date = v_plan_date;

  insert into public.intervenant_daily_task_plans (intervenant_id, chantier_id, task_id, plan_date, order_index)
  select v_intervenant_id, p_chantier_id, t.task_id, v_plan_date, t.ord - 1
  from unnest(coalesce(p_task_ids, array[]::uuid[])) with ordinality as t(task_id, ord)
  where exists (
    select 1 from public.chantier_tasks ct where ct.id = t.task_id and ct.chantier_id = p_chantier_id
  );

  return query
  select p.task_id, p.order_index
  from public.intervenant_daily_task_plans p
  where p.intervenant_id = v_intervenant_id
    and p.chantier_id = p_chantier_id
    and p.plan_date = v_plan_date
  order by p.order_index;
end;
$$;

revoke all on function public.intervenant_daily_task_plan_set(text, uuid, date, uuid[]) from public;
grant execute on function public.intervenant_daily_task_plan_set(text, uuid, date, uuid[]) to anon, authenticated;
