# Assistant Direction COCO - agent productif controle v1

## Objectif produit

Transformer COCO en assistant operationnel de direction et de preparation, capable d'analyser les donnees Batipro reelles, de preparer des brouillons exploitables et de proposer des actions, sans jamais ecrire une donnee metier definitive sans validation admin.

Principe central : anticipation + productivite controlee.

COCO doit pouvoir analyser, preparer, pre-remplir et proposer. COCO ne doit jamais valider, publier, envoyer, supprimer, commander, creer un chantier, modifier le planning officiel ou contourner les permissions sans action humaine explicite.

## Existant confirme sur dev

Routes et pages :

- `/assistant-direction` charge `src/pages/AssistantDirectionPage.tsx`.
- `/projets/:id/visites/:visitId` charge `src/pages/ProjectAppointmentPage.tsx`, puis `ProjectVisitQuotePrepPage` quand la visite realisee bascule en preparation devis.
- `/projets/:projectId/devis/nouveau` et `/projets/:projectId/devis/:quoteId/edit` utilisent le Quote Builder V1.
- Les routes CRM, chantiers, planning, taches, reserves, retours terrain, fournisseurs, bons de commande et catalogue produits existent deja dans `src/App.tsx`.

Services et fonctions :

- `src/services/cocoDirectionAssistant.service.ts` porte le contexte direction, les brouillons controles, les helpers chiffrage, preparation chantier et achats.
- `supabase/functions/coco-direction-assistant/index.ts` controle l'acces admin, nettoie le contexte et appelle OpenAI en mode chat direction ou brouillon apres visite.
- `src/services/crmVisitReports.service.ts` lit/ecrit les rapports de visite, lignes relevees et pieces jointes.
- `src/features/quotes/builder/quoteBuilderRepository.ts` sait creer un devis brouillon CRM depuis un brouillon COCO, puis passe par les permissions devis existantes.

Tables deja referencees par le code ou le schema fourni :

- CRM : `crm_clients`, `crm_prospects`, `crm_opportunities`, `crm_appointments`, `crm_visit_reports`, `crm_visit_report_items`, `crm_visit_report_attachments`, `crm_quotes`, `crm_quote_items`.
- Chantiers : `chantiers`, `chantier_tasks`, `chantier_time_entries`, `chantier_reserves`, `terrain_feedbacks`.
- Bibliotheques et achats : `task_templates`, `quote_library_items`, `product_catalog_items`, `suppliers`, `purchase_orders`, `material_orders`, `materiel_demandes`.
- Permissions : `profiles`, `profile_permission_presets`, `feature_permissions`.

Zone sensible : `ai_controlled_drafts` est deja prevu par le service comme stockage persistant optionnel. Si la table manque, le code degrade en historique local et affiche un message. La creation de cette table reste une evolution Supabase a valider avant application.

## Architecture cible modulaire

COCO reste un assistant de direction central, avec sous-domaines strictement relies aux modules Batipro existants :

1. Assistant Direction COCO
   - Module : pilotage dirigeant.
   - Sources : CRM, devis, chantiers, taches, temps, materiel, factures, opportunites.
   - Sorties : priorites, risques, arbitrages, charge equipe, carnet de commandes, besoins sous-traitance ou embauche.

2. Assistant Chiffrage
   - Module : visite de chiffrage, pre-devis, devis.
   - Sources : projet commercial, visite, rapport terrain, lignes relevees, pieces jointes referencees, bibliotheque de taches, fournisseurs actifs.
   - Sorties : lignes de pre-devis, temps estimes, materiaux, fournisseurs suggerees, risques et points a verifier.

3. Assistant Preparation chantier
   - Module : preparation chantier.
   - Sources : devis brouillon ou accepte, lignes COCO, bibliotheque de taches, contraintes chantier.
   - Sorties : taches brouillons, zones a confirmer, checklist, documents requis, planning previsionnel non officiel.

4. Assistant Achats
   - Module : approvisionnement.
   - Sources : besoins materiaux, fournisseurs actifs, references fournisseur quand disponibles.
   - Sorties : besoins materiaux structures, bons de commande fournisseurs brouillons, points prix/delai/reference a verifier.

5. Assistant Suivi chantier
   - Module : execution/pilotage.
   - Sources : planning, temps prevu/passe, retours terrain, reserves, demandes materiel, notes chantier.
   - Sorties : retards, derives, reserves critiques, actions correctives proposees.

6. Assistant Commercial
   - Module : CRM.
   - Sources : prospects, opportunites, devis ouverts, relances, pipeline.
   - Sorties : relances commerciales brouillons, priorites pipeline, periodes creuses, previsions carnet de commandes.

Aucune logique parallele ne doit etre creee pour remplacer les modules existants. Les sorties COCO sont des brouillons et doivent etre transformees par les workflows metier deja en place.

## Contrat de brouillon IA

Chaque brouillon doit contenir au minimum :

- `kind` : type de brouillon (`visit_quote_analysis`, `tasks`, `planning`, `materials`, `purchase_order`, `commercial_action`, `checklist`).
- `sourceSummary` : donnees Batipro utilisees.
- `confidence` : `haute`, `moyenne` ou `faible`.
- `hypotheses` : ce qui n'est pas prouve par les donnees.
- `pointsToVerify` : controles admin avant validation.
- `risks` : risques metier, chiffrage, planning, achat ou commercial.
- `proposedActions` : actions proposees, jamais executees automatiquement.
- `adminValidationRequired: true`.
- `finalWriteBlocked: true`.

Statuts autorises :

- `prepared` : brouillon prepare par COCO.
- `reviewed` : brouillon relu par admin, sans creation metier definitive.
- `validated` : pret a etre transforme par un workflow metier controle.
- `ignored` : proposition ecartee.

Validation ne signifie pas envoi client, commande fournisseur, creation chantier ou modification planning. Elle signifie uniquement que l'admin accepte de poursuivre dans le module metier correspondant.

## Cas pilote : analyse apres visite de chiffrage

Flux attendu :

1. Admin ouvre une visite de chiffrage realisee.
2. `ProjectVisitQuotePrepPage` lit le projet, la visite, le rapport de visite, les lignes, les pieces jointes referencees et les donnees de bibliotheque/fournisseurs via `cocoDirectionAssistant.service.ts`.
3. COCO appelle `coco-direction-assistant` en mode `visit_quote_draft`.
4. La fonction verifie la session et le profil admin, nettoie le contexte, applique le prompt chiffrage et exige une reponse JSON.
5. Le front affiche le brouillon : sources, confiance, hypotheses, points a verifier, risques, lignes pre-devis, besoins materiaux, actions proposees.
6. Admin peut revoir, ignorer, ou valider pour creer un devis CRM en statut `brouillon` via le Quote Builder existant.
7. Les taches chantier et achats restent des brouillons ; leur creation definitive doit rester dans les modules chantier/achats apres acceptation du devis et validation admin.

Garde-fous du pilote :

- Pas d'ecriture dans un devis final.
- Pas d'envoi client.
- Pas de creation chantier.
- Pas de creation de taches definitives.
- Pas de modification du planning officiel.
- Pas de bon de commande definitif.
- Pas de suppression.
- Pas d'exposition au portail intervenant.

## Prompts systeme specialises

### Direction

Tu es Assistant Direction COCO pour Batipro. Tu aides le dirigeant d'une entreprise de renovation a anticiper charge, risques, carnet de commandes, tresorerie si disponible, besoins humains, retards, marges et priorites. Utilise uniquement les donnees Batipro fournies. Distingue faits, hypotheses et inconnues. Propose des actions dirigeant classees par impact. N'ecris aucune donnee metier definitive et n'envoie rien sans validation admin.

### Chiffrage

Tu es Assistant Chiffrage COCO. Tu analyses une visite de chiffrage Batipro a partir du projet, du rapport de visite, des lignes relevees, des contraintes terrain, des pieces jointes referencees, de la bibliotheque Batipro et des fournisseurs disponibles. Produit un brouillon de pre-devis avec lots, lignes, quantites, temps estimes, materiaux, fournisseurs uniquement s'ils existent dans le contexte, sources, confiance, hypotheses, points a verifier et risques. Ne cree pas de devis final, ne cree pas de chantier et n'envoie rien au client.

### Preparation chantier

Tu es Assistant Preparation chantier COCO. Tu transformes un devis ou un brouillon de chiffrage en propositions de taches, zones, documents, checklist et planning previsionnel. Le planning propose n'est pas le planning officiel. Les taches ne sont pas creees definitivement. Tu dois expliciter les pre-requis, les dependances, les temps prevus incertains, les documents manquants et les validations admin necessaires.

### Achats

Tu es Assistant Achats COCO. Tu identifies les besoins materiaux et fournisseurs habituels a partir du chiffrage et des donnees Batipro. Tu peux preparer des bons de commande brouillons par fournisseur. Tu ne passes jamais commande, ne reserves rien, n'envoies aucun email fournisseur et ne crees aucune depense definitive. Tu distingues fournisseur confirme, fournisseur suppose et fournisseur a choisir.

### Suivi chantier

Tu es Assistant Suivi chantier COCO. Tu analyses planning, taches, temps, retours terrain, reserves, notes et demandes materiel pour detecter retards, derives et actions correctives. Tu proposes des actions a revoir par l'admin ou le conducteur de travaux. Tu ne modifies pas l'avancement, les reserves, les taches, les dates ou le planning officiel sans validation humaine.

### Commercial

Tu es Assistant Commercial COCO. Tu analyses prospects, clients, opportunites, devis, relances et pipeline. Tu prepares des actions commerciales brouillons : relance, appel, email a rediger, priorite de devis, opportunite a qualifier. Tu ne contactes jamais un client, n'envoies pas de devis, ne change pas le statut d'une opportunite et ne modifie pas le CRM sans validation admin.

## SQL manuel pour historique persistant des brouillons

A valider puis executer manuellement dans Supabase si l'historique persistant COCO doit etre active. Ce SQL cree une table dediee aux brouillons IA, sans modifier les tables metier finales.

```sql
create table if not exists public.ai_controlled_drafts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default auth.uid(),
  source_kind text not null,
  source_id uuid null,
  project_id uuid null,
  kind text not null check (kind in ('visit_quote_analysis', 'quote', 'tasks', 'planning', 'materials', 'purchase_order', 'commercial_action', 'checklist')),
  status text not null default 'prepared' check (status in ('prepared', 'reviewed', 'validated', 'ignored')),
  title text not null,
  confidence text not null default 'moyenne' check (confidence in ('haute', 'moyenne', 'faible')),
  source_summary text[] not null default '{}',
  hypotheses text[] not null default '{}',
  points_to_verify text[] not null default '{}',
  risks text[] not null default '{}',
  payload jsonb not null default '{}'::jsonb,
  reviewed_at timestamptz null,
  validated_at timestamptz null,
  ignored_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_controlled_drafts_source_idx on public.ai_controlled_drafts (organization_id, source_kind, source_id, created_at desc);
create index if not exists ai_controlled_drafts_project_idx on public.ai_controlled_drafts (organization_id, project_id, created_at desc);
create index if not exists ai_controlled_drafts_status_idx on public.ai_controlled_drafts (organization_id, status, created_at desc);

alter table public.ai_controlled_drafts enable row level security;

drop policy if exists ai_controlled_drafts_admin_all on public.ai_controlled_drafts;
create policy ai_controlled_drafts_admin_all
  on public.ai_controlled_drafts
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'ADMIN'
        and coalesce((p.feature_permissions ->> 'assistant_coco_direction')::boolean, true) = true
    )
  )
  with check (
    organization_id = auth.uid()
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'ADMIN'
        and coalesce((p.feature_permissions ->> 'assistant_coco_direction')::boolean, true) = true
    )
  );
```

## Verification fonctionnelle attendue

A verifier apres activation complete :

- TypeScript et build Vite.
- Acces `/assistant-direction` admin uniquement.
- Acces visite de chiffrage realisee vers preparation devis.
- Generation brouillon chiffrage avec sources, confiance, hypotheses, points a verifier, risques et actions.
- Historique persistant si `ai_controlled_drafts` est creee ; degradation locale si absente.
- Validation admin cree uniquement un devis CRM en statut `brouillon`.
- Aucune modification planning officiel, chantier, tache definitive, bon de commande definitif, RLS existante ou portail intervenant.

## Prochaines etapes recommandees

1. Ajouter la permission `assistant_coco_direction` au catalogue des profils types UI pour la rendre pilotable depuis Parametres.
2. Valider puis appliquer le SQL `ai_controlled_drafts` si l'historique persistant doit etre actif en production.
3. Ajouter un bouton de reprise depuis un brouillon valide vers le module Achats, mais uniquement sous forme de pre-remplissage de bon de commande brouillon.
4. Ajouter un brouillon de planning previsionnel separe du planning officiel.
5. Ajouter une vue dirigeant des propositions IA ouvertes par module : chiffrage, preparation, achats, suivi, commercial.
