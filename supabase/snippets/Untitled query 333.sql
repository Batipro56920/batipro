alter table public.chantiers
add column if not exists adresse text;
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'chantiers'
order by ordinal_position;

alter table public.devis_lignes
add column if not exists entreprise text;

