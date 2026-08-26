-- Fil chantier partagé entre ouvriers, sous-traitants et bureau.
--
-- chantier_feed_posts / chantier_feed_attachments existent déjà en production sans migration
-- versionnée (dérive de schéma). Les blocs ci-dessous les documentent (create table if not exists,
-- sans effet sur l'existant) avant d'étendre le modèle pour que le portail terrain écrive dans le
-- même fil que le bureau, au lieu du fil personnel (filtré par auteur) qu'utilisait terrain_feedbacks.

create table if not exists public.chantier_feed_posts (
  id uuid primary key default gen_random_uuid(),
  chantier_id uuid not null references public.chantiers(id) on delete cascade,
  author_id uuid not null default auth.uid(),
  author_name text not null,
  author_role text,
  body text not null,
  visibility text not null default 'equipe',
  parent_post_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chantier_feed_posts_body_chk check (char_length(btrim(body)) between 1 and 5000),
  constraint chantier_feed_posts_visibility_chk check (visibility in ('equipe', 'backoffice')),
  constraint chantier_feed_posts_not_self_reply_chk check (parent_post_id is null or parent_post_id <> id),
  constraint chantier_feed_posts_id_chantier_uniq unique (id, chantier_id)
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'chantier_feed_posts_parent_fk') then
    alter table public.chantier_feed_posts
      add constraint chantier_feed_posts_parent_fk
      foreign key (parent_post_id, chantier_id) references public.chantier_feed_posts(id, chantier_id);
  end if;
end $$;

create index if not exists chantier_feed_posts_chantier_created_idx on public.chantier_feed_posts (chantier_id, created_at desc);
create index if not exists chantier_feed_posts_parent_idx on public.chantier_feed_posts (parent_post_id) where parent_post_id is not null;

create table if not exists public.chantier_feed_attachments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.chantier_feed_posts(id) on delete cascade,
  document_id uuid not null references public.chantier_documents(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint chantier_feed_attachments_post_document_uniq unique (post_id, document_id)
);

create index if not exists chantier_feed_attachments_post_idx on public.chantier_feed_attachments (post_id, created_at);
create index if not exists chantier_feed_attachments_document_idx on public.chantier_feed_attachments (document_id);

alter table public.chantier_feed_posts enable row level security;
alter table public.chantier_feed_attachments enable row level security;

-- Marque les publications faites par un intervenant terrain (ouvrier/sous-traitant) plutôt que par un compte bureau.
alter table public.chantier_feed_posts
  add column if not exists author_intervenant_id uuid references public.intervenants(id) on delete set null;

create index if not exists chantier_feed_posts_author_intervenant_idx
  on public.chantier_feed_posts (author_intervenant_id) where author_intervenant_id is not null;

-- Les comptes bureau (ADMIN et BUREAU, pas seulement ADMIN) peuvent lire/écrire le fil.
drop policy if exists chantier_feed_posts_admin_select on public.chantier_feed_posts;
create policy chantier_feed_posts_admin_select on public.chantier_feed_posts
  for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('ADMIN', 'BUREAU')));

drop policy if exists chantier_feed_posts_admin_insert on public.chantier_feed_posts;
create policy chantier_feed_posts_admin_insert on public.chantier_feed_posts
  for insert
  with check (
    author_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('ADMIN', 'BUREAU'))
  );

drop policy if exists chantier_feed_attachments_admin_select on public.chantier_feed_attachments;
create policy chantier_feed_attachments_admin_select on public.chantier_feed_attachments
  for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('ADMIN', 'BUREAU')));

drop policy if exists chantier_feed_attachments_admin_insert on public.chantier_feed_attachments;
create policy chantier_feed_attachments_admin_insert on public.chantier_feed_attachments
  for insert
  with check (
    exists (
      select 1
      from public.profiles profile
      join public.chantier_feed_posts post on post.id = chantier_feed_attachments.post_id
      join public.chantier_documents document
        on document.id = chantier_feed_attachments.document_id
        and document.chantier_id = post.chantier_id
      where profile.id = auth.uid() and profile.role in ('ADMIN', 'BUREAU')
    )
  );

-- RPC portail terrain : lit/écrit le même fil que le bureau, scopé par jeton ou session intervenant.
-- Les intervenants ne voient jamais les notes "back-office uniquement".
create or replace function public.intervenant_chantier_feed_list(
  p_token text,
  p_chantier_id uuid
)
returns table (
  id uuid,
  chantier_id uuid,
  author_id uuid,
  author_name text,
  author_role text,
  author_intervenant_id uuid,
  body text,
  visibility text,
  parent_post_id uuid,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public._intervenant_assert_chantier_access(p_token, p_chantier_id);

  return query
  select
    fp.id, fp.chantier_id, fp.author_id, fp.author_name, fp.author_role,
    fp.author_intervenant_id, fp.body, fp.visibility, fp.parent_post_id,
    fp.created_at, fp.updated_at
  from public.chantier_feed_posts fp
  where fp.chantier_id = p_chantier_id
    and fp.visibility = 'equipe'
  order by fp.created_at asc
  limit 500;
end;
$$;

revoke all on function public.intervenant_chantier_feed_list(text, uuid) from public;
grant execute on function public.intervenant_chantier_feed_list(text, uuid) to anon, authenticated;

create or replace function public.intervenant_chantier_feed_create(
  p_token text,
  p_chantier_id uuid,
  p_body text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_intervenant_id uuid;
  v_body text;
  v_nom text;
  v_row public.chantier_feed_posts%rowtype;
begin
  v_body := nullif(btrim(coalesce(p_body, '')), '');
  if v_body is null then
    raise exception 'body_required';
  end if;
  if char_length(v_body) > 5000 then
    raise exception 'body_too_long';
  end if;

  v_intervenant_id := public._intervenant_assert_chantier_access(p_token, p_chantier_id);

  select i.nom into v_nom from public.intervenants i where i.id = v_intervenant_id;

  insert into public.chantier_feed_posts (
    chantier_id, author_id, author_intervenant_id, author_name, author_role, body, visibility
  ) values (
    p_chantier_id, v_intervenant_id, v_intervenant_id, coalesce(v_nom, 'Intervenant'), 'INTERVENANT', v_body, 'equipe'
  )
  returning * into v_row;

  return jsonb_build_object(
    'id', v_row.id,
    'chantier_id', v_row.chantier_id,
    'author_id', v_row.author_id,
    'author_intervenant_id', v_row.author_intervenant_id,
    'author_name', v_row.author_name,
    'author_role', v_row.author_role,
    'body', v_row.body,
    'visibility', v_row.visibility,
    'parent_post_id', v_row.parent_post_id,
    'created_at', v_row.created_at,
    'updated_at', v_row.updated_at
  );
end;
$$;

revoke all on function public.intervenant_chantier_feed_create(text, uuid, text) from public;
grant execute on function public.intervenant_chantier_feed_create(text, uuid, text) to anon, authenticated;

-- Pont automatique : un blocage signalé côté terrain apparaît immédiatement dans le fil chantier
-- partagé, sans attendre qu'un admin le traite manuellement depuis "Retours terrain".
create or replace function public.intervenant_terrain_feedback_create(
  p_token text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_chantier_id uuid;
  v_intervenant_id uuid;
  v_category text;
  v_urgency text;
  v_title text;
  v_description text;
  v_row public.terrain_feedbacks%rowtype;
  v_nom text;
begin
  v_chantier_id := nullif(btrim(coalesce(p_payload ->> 'chantier_id', '')), '')::uuid;
  if v_chantier_id is null then
    raise exception 'chantier_id_required';
  end if;

  v_intervenant_id := public._intervenant_assert_chantier_access(p_token, v_chantier_id);
  if v_intervenant_id is null then
    raise exception 'intervenant_required';
  end if;

  v_category := public._terrain_feedback_normalize_category(p_payload ->> 'category');
  if v_category is null then
    raise exception 'category_required';
  end if;

  v_urgency := public._terrain_feedback_normalize_urgency(p_payload ->> 'urgency');
  v_title := nullif(btrim(coalesce(p_payload ->> 'title', '')), '');
  if v_title is null then
    raise exception 'title_required';
  end if;

  v_description := nullif(btrim(coalesce(p_payload ->> 'description', '')), '');
  if v_description is null then
    raise exception 'description_required';
  end if;

  insert into public.terrain_feedbacks (
    chantier_id,
    author_intervenant_id,
    category,
    urgency,
    title,
    description
  ) values (
    v_chantier_id,
    v_intervenant_id,
    v_category,
    v_urgency,
    v_title,
    v_description
  )
  returning * into v_row;

  if v_category = 'blocage' then
    select i.nom into v_nom from public.intervenants i where i.id = v_intervenant_id;
    insert into public.chantier_feed_posts (
      chantier_id, author_id, author_intervenant_id, author_name, author_role, body, visibility
    ) values (
      v_chantier_id, v_intervenant_id, v_intervenant_id, coalesce(v_nom, 'Intervenant'), 'INTERVENANT',
      '🔴 Blocage signalé : ' || v_description, 'equipe'
    );
  end if;

  perform public._terrain_feedback_history_insert(
    v_row.id,
    null,
    'Portail intervenant',
    'created',
    jsonb_build_object(
      'status', v_row.status,
      'category', v_row.category,
      'urgency', v_row.urgency
    )
  );

  return jsonb_build_object(
    'id', v_row.id,
    'chantier_id', v_row.chantier_id,
    'author_intervenant_id', v_row.author_intervenant_id,
    'category', v_row.category,
    'urgency', v_row.urgency,
    'title', v_row.title,
    'description', v_row.description,
    'status', v_row.status,
    'assigned_to', v_row.assigned_to,
    'assigned_to_name', v_row.assigned_to_name,
    'treatment_comment', v_row.treatment_comment,
    'treated_at', v_row.treated_at,
    'created_at', v_row.created_at,
    'updated_at', v_row.updated_at,
    'attachments', '[]'::jsonb
  );
end;
$$;

revoke all on function public.intervenant_terrain_feedback_create(text, jsonb) from public;
grant execute on function public.intervenant_terrain_feedback_create(text, jsonb) to anon, authenticated;
