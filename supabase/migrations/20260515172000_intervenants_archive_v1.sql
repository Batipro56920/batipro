alter table public.intervenants
  add column if not exists archived_at timestamptz null;

create index if not exists intervenants_archived_at_idx
  on public.intervenants (archived_at);
