insert into public.chantier_intervenants (chantier_id, intervenant_id)
select distinct
  i.chantier_id,
  i.id
from public.intervenants i
where i.chantier_id is not null
on conflict (chantier_id, intervenant_id) do nothing;

insert into public.intervenant_chantiers (intervenant_id, chantier_id)
select distinct
  i.id,
  i.chantier_id
from public.intervenants i
where i.chantier_id is not null
on conflict (intervenant_id, chantier_id) do nothing;
