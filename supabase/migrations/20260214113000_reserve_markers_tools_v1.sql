alter table public.reserve_plan_markers
  add column if not exists document_id uuid null references public.chantier_documents(id) on delete cascade,
  add column if not exists page_number int null,
  add column if not exists type text not null default 'POINT',
  add column if not exists color text not null default '#ef4444',
  add column if not exists stroke_width int not null default 2,
  add column if not exists x1 double precision null,
  add column if not exists y1 double precision null,
  add column if not exists x2 double precision null,
  add column if not exists y2 double precision null,
  add column if not exists text text null;

update public.reserve_plan_markers
set
  document_id = coalesce(document_id, plan_document_id),
  page_number = coalesce(page_number, page),
  x1 = coalesce(x1, x),
  y1 = coalesce(y1, y),
  type = coalesce(type, 'POINT'),
  color = coalesce(color, '#ef4444'),
  stroke_width = coalesce(stroke_width, 2),
  text = coalesce(text, label)
where
  document_id is null
  or page_number is null
  or x1 is null
  or y1 is null
  or type is null
  or color is null
  or stroke_width is null;

create index if not exists reserve_plan_markers_document_idx
  on public.reserve_plan_markers(document_id);

create index if not exists reserve_plan_markers_document_page_idx
  on public.reserve_plan_markers(document_id, page_number);
