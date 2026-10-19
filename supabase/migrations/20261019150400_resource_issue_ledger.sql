-- Sorties réelles issues des confirmations du matin.
-- Une préparation ne peut alimenter le journal de mouvements qu'une seule fois.
create table if not exists public.portal_resource_movements (
 id uuid primary key default gen_random_uuid(),
 preparation_id uuid not null unique references public.portal_resource_preparations(id),
 organization_id uuid not null,
 chantier_id uuid not null,
 intervenant_id uuid not null,
 resource_type text not null check(resource_type in ('equipment','consumable')),
 resource_id text not null,
 quantity numeric not null check(quantity > 0),
 movement_type text not null default 'sortie_depot' check(movement_type='sortie_depot'),
 occurred_at timestamptz not null default now()
);
create index if not exists portal_resource_movements_by_resource on public.portal_resource_movements(organization_id,resource_type,resource_id,occurred_at);
alter table public.portal_resource_movements enable row level security;
revoke all on public.portal_resource_movements from anon,authenticated;
create or replace function public.intervenant_resource_issue(p_token text,p_chantier_id uuid,p_preparation_id uuid)
returns jsonb language plpgsql security definer set search_path = public,pg_temp as $$
declare v_worker uuid;v_row public.portal_resource_preparations%rowtype;
begin
 v_worker:=public._intervenant_assert_chantier_access(p_token,p_chantier_id);
 if v_worker is null then raise exception 'forbidden'; end if;
 select * into v_row from public.portal_resource_preparations
 where id=p_preparation_id and chantier_id=p_chantier_id and intervenant_id=v_worker for update;
 if not found then raise exception 'preparation_not_found'; end if;
 if v_row.status='issued' then return jsonb_build_object('id',v_row.id,'status','issued','already_issued',true); end if;
 if v_row.status<>'reserved' then raise exception 'preparation_not_reserved'; end if;
 insert into public.portal_resource_movements(preparation_id,organization_id,chantier_id,intervenant_id,resource_type,resource_id,quantity)
 values(v_row.id,v_row.organization_id,v_row.chantier_id,v_row.intervenant_id,v_row.resource_type,v_row.resource_id,v_row.quantity)
 on conflict(preparation_id) do nothing;
 update public.portal_resource_preparations set status='issued', issued_at=now() where id=v_row.id;
 return jsonb_build_object('id',v_row.id,'status','issued','already_issued',false);
end $$;
revoke all on function public.intervenant_resource_issue(text,uuid,uuid) from public;
grant execute on function public.intervenant_resource_issue(text,uuid,uuid) to anon, authenticated;
