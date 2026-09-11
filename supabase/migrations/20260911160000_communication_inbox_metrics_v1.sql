-- Rendre la boîte de réception et les statistiques alimentables.
--
-- Les deux tables existaient mais rien ne les remplissait, faute de pouvoir
-- réécrire une ligne déjà connue : sans contrainte d'unicité, chaque
-- synchronisation aurait empilé des doublons.

alter table public.communication_inbox_threads
  add column if not exists permalink text,
  add column if not exists last_synced_at timestamptz,
  add column if not exists unread boolean not null default true;

comment on column public.communication_inbox_threads.unread is
  'Faux dès qu''une réponse part du bureau ou que la conversation est traitée.';

alter table public.communication_inbox_messages
  add column if not exists provider_parent_id text;

comment on column public.communication_inbox_messages.provider_parent_id is
  'Commentaire auquel répondre chez le réseau, quand la réponse ne va pas sur le fil.';

-- Une seule mesure courante par version publiée : on écrase, on n'empile pas.
delete from public.communication_post_metrics a
using public.communication_post_metrics b
where a.variant_id = b.variant_id and a.measured_at < b.measured_at;

alter table public.communication_post_metrics
  add column if not exists sync_error text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'communication_post_metrics_variant_unique'
  ) then
    alter table public.communication_post_metrics
      add constraint communication_post_metrics_variant_unique unique (variant_id);
  end if;
end $$;

create index if not exists communication_inbox_threads_unread_idx
  on public.communication_inbox_threads (organization_id, unread, last_message_at desc);
