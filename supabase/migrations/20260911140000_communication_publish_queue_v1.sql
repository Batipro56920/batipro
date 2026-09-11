-- La planification doit produire un travail de publication.
--
-- La table communication_publish_jobs existait mais rien ne l'alimentait :
-- valider puis planifier une publication ne déclenchait aucune diffusion. Le
-- déclencheur ci-dessous fait le lien, quel que soit l'écran qui planifie, et
-- annule les travaux en attente dès qu'une publication quitte la planification.

create or replace function public.communication_sync_publish_jobs()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.status = 'scheduled' and new.scheduled_at is not null then
    insert into public.communication_publish_jobs (organization_id, variant_id, scheduled_at, status)
    select variant.organization_id, variant.id, new.scheduled_at, 'queued'
    from public.communication_publication_variants as variant
    where variant.item_id = new.id
      and variant.approval_status = 'approved'
      and variant.social_account_id is not null
      and not exists (
        select 1 from public.communication_publish_jobs as job
        where job.variant_id = variant.id and job.status in ('queued', 'processing', 'published')
      );

    -- Déplacer la date d'une publication déjà planifiée doit déplacer le travail.
    update public.communication_publish_jobs as job
    set scheduled_at = new.scheduled_at, updated_at = now()
    from public.communication_publication_variants as variant
    where variant.id = job.variant_id
      and variant.item_id = new.id
      and job.status = 'queued'
      and job.scheduled_at is distinct from new.scheduled_at;
  else
    update public.communication_publish_jobs as job
    set status = 'cancelled', updated_at = now()
    from public.communication_publication_variants as variant
    where variant.id = job.variant_id
      and variant.item_id = new.id
      and job.status = 'queued';
  end if;
  return new;
end;
$$;

drop trigger if exists communication_items_publish_jobs on public.communication_campaign_items;
create trigger communication_items_publish_jobs
  after insert or update of status, scheduled_at
  on public.communication_campaign_items
  for each row execute function public.communication_sync_publish_jobs();

-- Le média publié doit pouvoir être retrouvé depuis la publication.
alter table public.communication_publish_jobs
  add column if not exists asset_id uuid;

create index if not exists communication_publish_jobs_variant_idx
  on public.communication_publish_jobs (variant_id, status);
