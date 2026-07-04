# Sprint 3 - Lots persistants et moteur de calcul ouvrage

## Objectif

Transformer les lots metier et les calculs ouvrage en donnees partagees et reutilisables par Batipro et Coco.

## Statut

Une migration Supabase a ete ajoutee pour creer la table `task_template_lot_profiles` avec les lots par defaut.

Fichier : `supabase/migrations/20260704193000_task_template_lot_profiles.sql`

## Table creee

`task_template_lot_profiles`

Champs principaux :

- id
- label
- keywords
- labor_margin_rate
- default_unit
- quote_visible_default
- chantier_visible_default
- field_guidance
- default_tools
- default_controls
- default_errors_to_avoid
- created_at
- updated_at

## Lots initiaux

- Electricite : marge main d'oeuvre 55 %, unite u
- Platrerie : marge main d'oeuvre 30 %, unite m2
- Peinture : marge main d'oeuvre 30 %, unite m2
- Plomberie : marge main d'oeuvre 45 %, unite u
- Menuiserie : marge main d'oeuvre 35 %, unite u
- Sols / carrelage : marge main d'oeuvre 35 %, unite m2
- Facade : marge main d'oeuvre 35 %, unite m2

## Suite a finaliser dans le code applicatif

1. Remplacer le stockage localStorage des lots par une lecture Supabase avec fallback local.
2. Brancher le drawer `Parametrer les lots` sur cette table.
3. Creer un moteur de calcul centralise :
   - cout matiere par unite
   - prix vente matiere par unite
   - cout main d'oeuvre
   - prix vente main d'oeuvre selon marge du lot
   - frais
   - prix de revient ouvrage
   - prix de vente ouvrage
   - marge montant
   - taux de marge
4. Utiliser ce moteur dans :
   - drawer template
   - generation Coco
   - calcul ouvrage
   - devis futur

## Regle metier

Coco ne doit pas recalculer differemment de Batipro. Il doit utiliser les memes donnees lot et le meme moteur de calcul que l'application.
