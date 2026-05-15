alter table public.chantiers
  add column if not exists completed_at timestamptz null,
  add column if not exists archived_at timestamptz null,
  add column if not exists cancelled_at timestamptz null,
  add column if not exists deleted_at timestamptz null,
  add column if not exists lifecycle_updated_at timestamptz null;

update public.chantiers
set status = case
  when upper(coalesce(status::text, '')) in ('BROUILLON', 'DRAFT') then 'BROUILLON'
  when upper(coalesce(status::text, '')) in ('PREPARATION', 'PRÉPARATION', 'PREPA') then 'PREPARATION'
  when upper(coalesce(status::text, '')) in ('EN_COURS', 'EN COURS', 'ACTIVE') then 'EN_COURS'
  when upper(coalesce(status::text, '')) in ('EN_PAUSE', 'PAUSE', 'PAUSED') then 'EN_PAUSE'
  when upper(coalesce(status::text, '')) in ('TERMINE', 'TERMINÉ', 'DONE', 'COMPLETED') then 'TERMINE'
  when upper(coalesce(status::text, '')) in ('ARCHIVE', 'ARCHIVÉ') then 'ARCHIVE'
  when upper(coalesce(status::text, '')) in ('ANNULE', 'ANNULÉ', 'CANCELLED') then 'ANNULE'
  else 'PREPARATION'
end;

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'chantiers'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%status%'
  loop
    execute format('alter table public.chantiers drop constraint if exists %I', constraint_name);
  end loop;
end $$;

alter table public.chantiers
  add constraint chantiers_status_lifecycle_chk
  check (status in ('BROUILLON', 'PREPARATION', 'EN_COURS', 'EN_PAUSE', 'TERMINE', 'ARCHIVE', 'ANNULE'));

create index if not exists chantiers_status_deleted_idx
  on public.chantiers (status, deleted_at);
