-- Un vocabulaire unique pour les canaux, et une date de diffusion réelle.
--
-- Le tableau enregistrait des libellés ("Facebook", "Google", "Site web") et le
-- compositeur des identifiants ("facebook", "google_business"). Le calendrier,
-- qui colore et filtre sur la valeur stockée, voyait deux réseaux différents
-- pour un seul. Tout est ramené aux identifiants.
--
-- La colonne published_at manquait : une carte pouvait atteindre la colonne
-- "Publiées" sans que rien ne dise quand, ni si la diffusion avait eu lieu.

alter table public.communication_campaign_items
  add column if not exists published_at timestamptz;

comment on column public.communication_campaign_items.published_at is
  'Date de diffusion effective, renseignée quand la publication est marquée publiée.';

create or replace function public.communication_normalize_channel(value text)
returns text language sql immutable set search_path = public, pg_temp as $$
  with slug as (
    select trim(both '_' from lower(regexp_replace(coalesce(value, ''), '[^a-zA-Z0-9]+', '_', 'g'))) as key
  )
  select case key
    when 'google' then 'google_business'
    when 'google_business_profile' then 'google_business'
    when 'site' then 'site_web'
    when 'siteweb' then 'site_web'
    when 'web' then 'site_web'
    when 'fb' then 'facebook'
    when 'insta' then 'instagram'
    else key
  end
  from slug;
$$;

update public.communication_campaigns
set channels = coalesce(
  (select array_agg(distinct public.communication_normalize_channel(channel))
   from unnest(channels) as channel
   where public.communication_normalize_channel(channel) <> ''),
  '{}')
where channels is not null and cardinality(channels) > 0;

update public.communication_campaign_items
set channels = coalesce(
  (select array_agg(distinct public.communication_normalize_channel(channel))
   from unnest(channels) as channel
   where public.communication_normalize_channel(channel) <> ''),
  '{}')
where channels is not null and cardinality(channels) > 0;
