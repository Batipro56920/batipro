create or replace function public.batipro_can_manage_chantier_preparation_notes()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null;
$$;

revoke all on function public.batipro_can_manage_chantier_preparation_notes() from public;
grant execute on function public.batipro_can_manage_chantier_preparation_notes() to authenticated;

do $$
begin
  if to_regclass('public.chantier_preparation_notes') is not null then
    alter table public.chantier_preparation_notes
      add column if not exists task_id uuid null references public.chantier_tasks(id) on delete set null,
      add column if not exists zone_id uuid null references public.chantier_zones(id) on delete set null,
      add column if not exists change_order_id uuid null references public.chantier_change_orders(id) on delete set null,
      add column if not exists document_id uuid null references public.chantier_documents(id) on delete set null;

    create index if not exists chantier_preparation_notes_task_idx
      on public.chantier_preparation_notes (task_id);
    create index if not exists chantier_preparation_notes_zone_idx
      on public.chantier_preparation_notes (zone_id);
    create index if not exists chantier_preparation_notes_change_order_idx
      on public.chantier_preparation_notes (change_order_id);
    create index if not exists chantier_preparation_notes_document_idx
      on public.chantier_preparation_notes (document_id);
  end if;
end $$;

do $$
begin
  if to_regclass('public.chantier_change_orders') is not null then
    alter table public.chantier_change_orders
      add column if not exists photo_ids uuid[] not null default '{}'::uuid[],
      add column if not exists quantite numeric(12,3),
      add column if not exists unite text,
      add column if not exists prix_unitaire_ht numeric(12,2),
      add column if not exists tva_rate numeric(5,2),
      add column if not exists total_ht numeric(12,2),
      add column if not exists total_ttc numeric(12,2),
      add column if not exists client_validation_required boolean not null default false;

    update public.chantier_change_orders
    set type_ecart = case
      when type_ecart in ('travaux_supplementaires', 'modification_client') then 'travaux_supplementaires'
      else 'imprevu'
    end
    where type_ecart not in ('imprevu', 'travaux_supplementaires');

    update public.chantier_change_orders
    set statut = case
      when type_ecart = 'travaux_supplementaires' and statut in ('a_analyser') then 'a_chiffrer'
      when type_ecart = 'travaux_supplementaires' and statut in ('en_attente_validation', 'a_valider') then 'en_attente_validation_client'
      when type_ecart = 'travaux_supplementaires' and statut in ('valide') then 'valide_client'
      when type_ecart = 'travaux_supplementaires' and statut in ('realise', 'integre') then 'termine'
      when type_ecart = 'imprevu' and statut in ('a_chiffrer', 'en_attente_validation', 'a_valider') then 'a_analyser'
      when type_ecart = 'imprevu' and statut in ('valide', 'realise', 'integre') then 'traite'
      else statut
    end
    where statut in (
      'a_analyser',
      'a_chiffrer',
      'en_attente_validation',
      'en_attente_validation_client',
      'a_valider',
      'valide',
      'valide_client',
      'realise',
      'integre'
    );

    update public.chantier_change_orders
    set client_validation_required = (type_ecart = 'travaux_supplementaires');

    update public.chantier_change_orders
    set total_ht = round(coalesce(quantite, 0) * coalesce(prix_unitaire_ht, 0), 2),
        total_ttc = round(round(coalesce(quantite, 0) * coalesce(prix_unitaire_ht, 0), 2) * (1 + coalesce(tva_rate, 0) / 100), 2),
        impact_cout_ht = case
          when type_ecart = 'travaux_supplementaires' then round(coalesce(quantite, 0) * coalesce(prix_unitaire_ht, 0), 2)
          else impact_cout_ht
        end
    where type_ecart = 'travaux_supplementaires';

    alter table public.chantier_change_orders
      alter column statut set default 'a_analyser';

    alter table public.chantier_change_orders
      drop constraint if exists chantier_change_orders_type_ecart_chk;

    alter table public.chantier_change_orders
      add constraint chantier_change_orders_type_ecart_chk
      check (type_ecart in ('imprevu', 'travaux_supplementaires'));

    alter table public.chantier_change_orders
      drop constraint if exists chantier_change_orders_statut_chk;

    alter table public.chantier_change_orders
      add constraint chantier_change_orders_statut_chk
      check (
        statut in (
          'a_analyser',
          'en_cours',
          'traite',
          'a_chiffrer',
          'en_attente_validation_client',
          'valide_client',
          'refuse',
          'termine',
          'facture'
        )
      );
  end if;
end $$;
