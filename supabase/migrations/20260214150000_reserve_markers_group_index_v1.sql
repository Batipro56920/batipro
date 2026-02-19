alter table public.reserve_plan_markers
  add column if not exists legend_label text null;

create index if not exists reserve_plan_markers_group_idx
  on public.reserve_plan_markers(document_id, page_number, type, color, stroke_width, legend_label);
