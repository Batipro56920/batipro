do $$
begin
  if to_regclass('public.task_templates') is not null then
    alter table public.task_templates
      add column if not exists description_technique text null,
      add column if not exists caracteristiques jsonb not null default '[]'::jsonb,
      add column if not exists cout_reference_unitaire_ht numeric null;

    update public.task_templates
    set caracteristiques = '[]'::jsonb
    where caracteristiques is null or jsonb_typeof(caracteristiques) <> 'array';
  end if;

  if to_regclass('public.chantier_tasks') is not null then
    alter table public.chantier_tasks
      add column if not exists task_template_id uuid null references public.task_templates(id) on delete set null,
      add column if not exists task_template_label text null,
      add column if not exists description_technique text null,
      add column if not exists caracteristiques jsonb not null default '[]'::jsonb,
      add column if not exists prix_unitaire_devis_ht numeric null,
      add column if not exists montant_total_devis_ht numeric null,
      add column if not exists tva_taux_devis numeric null,
      add column if not exists cout_estime_ht numeric null,
      add column if not exists cout_matiere_estime_ht numeric null,
      add column if not exists cout_mo_estime_ht numeric null,
      add column if not exists priorite text not null default 'normale';

    update public.chantier_tasks
    set
      titre_terrain = coalesce(nullif(btrim(titre_terrain), ''), nullif(btrim(titre), ''), 'Sans titre'),
      task_template_label = coalesce(
        nullif(btrim(task_template_label), ''),
        nullif(btrim(titre), ''),
        nullif(btrim(lot), ''),
        'Tâche chantier'
      ),
      caracteristiques = case
        when caracteristiques is null or jsonb_typeof(caracteristiques) <> 'array' then '[]'::jsonb
        else caracteristiques
      end,
      priorite = case
        when priorite in ('basse', 'normale', 'haute', 'urgente') then priorite
        else 'normale'
      end;

    if not exists (
      select 1
      from pg_constraint
      where conrelid = 'public.chantier_tasks'::regclass
        and conname = 'chantier_tasks_priorite_chk'
    ) then
      alter table public.chantier_tasks
        add constraint chantier_tasks_priorite_chk
        check (priorite in ('basse', 'normale', 'haute', 'urgente'));
    end if;

    create index if not exists chantier_tasks_template_idx
      on public.chantier_tasks (task_template_id, chantier_id);

    create index if not exists chantier_tasks_priorite_idx
      on public.chantier_tasks (priorite, chantier_id, order_index);
  end if;
end $$;
