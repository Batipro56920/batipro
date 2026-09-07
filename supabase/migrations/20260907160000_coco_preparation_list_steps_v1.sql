-- Le modèle renvoie parfois les étapes du mode opératoire sous forme d'objets
-- ({etape, objectif, duree, controle...}) au lieu de chaînes. Sans ces clés le
-- normaliseur renvoyait null et l'ouvrier se retrouvait avec un mode opératoire vide.

create or replace function public._coco_preparation_list(p_preparation jsonb, p_key text)
returns text[]
language sql
immutable
set search_path = public, pg_temp
as $$
  select coalesce(
    array(
      select value
      from (
        select case
          when jsonb_typeof(item) = 'string' then item #>> '{}'
          else coalesce(
            item ->> 'label',
            item ->> 'title',
            item ->> 'titre',
            item ->> 'text',
            item ->> 'etape',
            item ->> 'step',
            item ->> 'action',
            item ->> 'description',
            item ->> 'detail'
          )
        end as value
        from jsonb_array_elements(
          case
            when jsonb_typeof(p_preparation -> p_key) = 'array' then p_preparation -> p_key
            else '[]'::jsonb
          end
        ) as item
      ) as normalized
      where coalesce(value, '') <> ''
    ),
    '{}'::text[]
  );
$$;
