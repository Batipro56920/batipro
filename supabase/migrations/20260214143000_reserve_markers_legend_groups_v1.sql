alter table public.reserve_plan_markers
  add column if not exists legend_label text null,
  add column if not exists legend_key text null;

update public.reserve_plan_markers
set
  legend_key = coalesce(
    nullif(legend_key, ''),
    concat(coalesce(type, 'POINT'), ':', lower(coalesce(color, '#ef4444')))
  )
where
  legend_key is null
  or btrim(legend_key) = '';

create index if not exists reserve_plan_markers_document_page_legend_idx
  on public.reserve_plan_markers(document_id, page_number, legend_key);

create index if not exists reserve_plan_markers_legend_key_idx
  on public.reserve_plan_markers(legend_key);
