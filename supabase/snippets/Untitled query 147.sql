create or replace function public.prevent_unauthorized_task_updates()
returns trigger language plpgsql as $$
begin
  -- si ce n’est PAS un intervenant portail, on laisse passer
  if not public.is_intervenant_portal() then
    return new;
  end if;

  -- ✅ Interdire toute modification de colonnes non autorisées
  if
    new.titre          is distinct from old.titre
    or new.ordre       is distinct from old.ordre
    or new.chantier_id is distinct from old.chantier_id
    or new.intervenant_id is distinct from old.intervenant_id
    or new.corps_etat  is distinct from old.corps_etat
    or new.date        is distinct from old.date
    or new.created_at  is distinct from old.created_at
    or new.updated_at  is distinct from old.updated_at
  then
    raise exception 'Modification non autorisée sur cette tâche';
  end if;

  -- ✅ Colonnes autorisées : status / dates / temps
  -- (aucun contrôle supplémentaire nécessaire)
  return new;
end;
$$;

