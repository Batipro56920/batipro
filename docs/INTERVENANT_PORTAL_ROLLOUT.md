# Portail Intervenant - Rollout V2

## Flow actif

- Flow principal: `/intervenant?token=...`
- Token opaque stocke en base (`public.chantier_access`) ou session Supabase intervenant quand le compte est lie
- Validation via RPC SQL `SECURITY DEFINER`
- Cote intervenant: acces via RPC/services existants uniquement, sans logique de droits parallele cote front

## Compat legacy

- `/acces/:token` reste disponible comme entree historique/fallback
- Le portail operationnel public reste `/intervenant`
- Ne pas recreer un portail autonome: la V2 lit les chantiers, taches, documents, temps, consignes, reserves, retours et demandes exposes par l'admin

## Migration principale

- `supabase/migrations/20260222173000_intervenant_portal_multi_chantiers_v2.sql`
- `supabase/migrations/20260609194000_fix_intervenant_portal_chantiers_rpc.sql` a appliquer manuellement si la RPC `intervenant_get_chantiers` retourne une erreur de structure
- `supabase/migrations/20260609223000_fix_intervenant_planning_segments_sync.sql` a appliquer manuellement si les segments planifies admin ne remontent pas cote intervenant

Ces migrations versionnent ou corrigent notamment:

- multi-chantiers par token dans `chantier_access`
- RPC admin/intervenant: session, chantiers, taches, documents, planning, temps, materiel
- table `chantier_task_comments`
- table `chantier_time_entries`
- hardening RLS phase 1 pour `chantier_access`
- alignement schema materiel (`statut`: `en_attente|validee|refusee|livree`)

## UI livree

### Intervenant `/intervenant`

- Navigation basse mobile-first: `Accueil`, `Chantiers`, `Taches`, `Temps`, `Retours`
- Accueil terrain: taches du jour, temps du jour, contrainte principale, alertes utiles
- Chantiers: selection chantier, resume avancement, consignes, taches, plans/documents utiles, retours recents
- Taches: regroupement `Aujourd'hui`, `Cette semaine`, `Plus tard`
- Temps: acces rapide aux taches ouvertes pour ajouter une saisie de temps
- Retours: suivi des retours terrain, reserves et demandes d'information visibles
- Drawer tache mobile-first:
  - informations chantier/zone/lot/statut/quantites/temps
  - plans et documents lies visibles
  - actions terrain: ajouter temps, photo, remarque, signaler blocage/materiel/materiaux/information, marquer terminee
- Mobile iPhone/PWA:
  - usage de `dvh` et safe area via la navigation basse
  - drawer limite a la hauteur ecran avec scroll interne
  - cartes compactes et lisibles sans formulaire lourd en pleine page

### Admin `ChantierPage` et modules lies

- Le portail ne modifie pas la navigation back-office
- Les donnees restent pilotees par les modules admin existants: chantiers, taches, documents, consignes, temps, reserves, retours terrain, materiel
- Toute evolution des droits, RLS ou RPC reste une intervention Supabase separee avec validation manuelle

## Checklist smoke tests prioritaire

1. Token valide sur Safari iPhone / PWA
2. Token invalide, expire ou revoque
3. Compte intervenant lie avec session Supabase
4. Token avec un seul chantier
5. Token avec plusieurs chantiers + changement de chantier
6. Accueil: taches du jour et alertes visibles sans ecran vide silencieux
7. Chantiers: consignes, plans/documents utiles et retours recents visibles
8. Taches: ouverture drawer, informations lisibles, documents lies visibles
9. Temps: ajout `1,5 h`, recharge liste, cumul coherent admin/intervenant
10. Photo terrain: upload depuis mobile, piece jointe visible dans les retours admin
11. Signalement: blocage, manque materiel/materiaux, demande information
12. Tache terminee: statut remonte sans casser la validation admin
13. Retours/reserves/demandes: affichage et statuts lisibles
14. Largeur iPhone: aucune action basse ni drawer ne chevauche le contenu

## Etat verification 2026-06-25

- Le commit portail terrain `0e7d41c7fd5c916c87e001f8b1ca89bbe8e6ad68` a un statut GitHub/Vercel `failure`.
- Les logs Vercel detailles ne sont pas accessibles depuis l'environnement agent actuel.
- Le fichier versionne `build-output.txt` sur `dev` montre un `npm run build` reussi avec generation du bundle `IntervenantPortalPage`, ce qui oriente le diagnostic vers une verification Vercel/CI ou environnement, pas vers une erreur TypeScript certaine dans le portail.
- Le clone GitHub et le raw GitHub restent bloques dans l'environnement agent par proxy `403`, donc le build local ne peut pas etre relance ici.

## Notes ops

- Consulter le log Vercel du deploiement en echec avant nouvelle modification large du portail
- Verifier les variables Vercel Preview/Production necessaires, sans exposer de secret
- Redeployer Vercel apres correction de la cause exacte
- `supabase db push` doit rester manuel depuis un poste avec acces reseau direct Supabase
- Ne pas appliquer automatiquement de SQL/RLS depuis l'agent