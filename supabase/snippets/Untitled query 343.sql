select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema='public' and table_name='chantiers'
order by ordinal_position;

alter table public.chantiers
  add column if not exists date_fin_prevue date;
