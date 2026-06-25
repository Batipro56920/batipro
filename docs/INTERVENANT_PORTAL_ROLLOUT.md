# Portail Intervenant - Rollout V2

## Flow actif

- Flow public principal: `/intervenant?token=...`
- Flow interne protege: `/portail/employe/*`
- Route active: `src/pages/IntervenantPortalPage.tsx` exporte `src/pages/EmployeePortalV2Page.tsx`, lui-meme branche sur `src/pages/EmployeePortalFieldV2Page.tsx`
- Token opaque stocke en base (`public.chantier_access`) ou session Supabase intervenant quand le compte est lie
- Validation via RPC SQL `SECURITY DEFINER`
- Cote intervenant: acces via RPC/services existants uniquement, sans logique de droits parallele cote front

## Compat legacy

- `/acces/:token` reste disponible comme entree historique/fallback
- `/acces/:token` redirige vers `/intervenant?token=...`, afin de conserver une seule experience terrain active
- Le portail operationnel public reste `/intervenant`
- `/portail` redirige vers `/portail/employe` pour l'acces employe authentifie
- `/portail/employe/*` est protege par `RequireAuth`, sans layout admin, et force le contexte session Supabase plutot qu'un ancien token public stocke
- Les alias internes `IntervenantPortalV2Page` et `IntervenantPortalV2StrictPage` pointent vers `EmployeePortalV2Page`
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

### Intervenant public `/intervenant`

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

### Employe authentifie `/portail/employe/*`

- Meme experience terrain V2 que le portail public
- Acces protege par session Supabase via `RequireAuth`
- Affichage plein ecran sans `LayoutShell` ni sidebar admin
- Nettoyage des anciens tokens publics stockes avant chargement de la page interne
- Suppression de toute query string interne `?token=...` avant rendu du portail, pour eviter de prioriser un contexte public sur la session connectee

### Admin `ChantierPage` et modules lies

- Le portail ne modifie pas la navigation back-office
- Les donnees restent pilotees par les modules admin existants: chantiers, taches, documents, consignes, temps, reserves, retours terrain, materiel
- Toute evolution des droits, RLS ou RPC reste une intervention Supabase separee avec validation manuelle

## Checklist smoke tests prioritaire

1. Token valide sur Safari iPhone / PWA
2. Token invalide, expire ou revoque
3. Compte intervenant lie avec session Supabase sur `/portail/employe`
4. Navigateur ayant deja un token public stocke, puis ouverture de `/portail/employe`: les donnees doivent venir de la session auth
5. `/portail/employe?token=ancien_token`: l'URL doit etre nettoyee avant rendu et les donnees doivent venir de la session auth
6. Token avec un seul chantier
7. Token avec plusieurs chantiers + changement de chantier
8. Accueil: taches du jour et alertes visibles sans ecran vide silencieux
9. Chantiers: consignes, plans/documents utiles et retours recents visibles
10. Taches: ouverture drawer, informations lisibles, documents lies visibles
11. Temps: ajout `1,5 h`, `1 234,5 h`, `1.234,5 h`; refus de `1,`, `1.`, vide et negatif
12. Photo terrain: upload depuis mobile, piece jointe visible dans les retours admin
13. Signalement: blocage, manque materiel/materiaux, demande information
14. Tache terminee: statut remonte sans casser la validation admin
15. Retours/reserves/demandes: affichage et statuts lisibles
16. Largeur iPhone: aucune action basse ni drawer ne chevauche le contenu

## Etat verification 2026-06-25

- Route publique active confirmee: `/intervenant` charge `src/pages/IntervenantPortalPage.tsx`, qui exporte `EmployeePortalV2Page`.
- Route interne active confirmee: `/portail` redirige vers `/portail/employe`, puis `/portail/employe/*` charge `IntervenantPortalPage` derriere `RequireAuth`, sans layout admin.
- Acces historique confirme: `/acces/:token` est une passerelle vers `/intervenant?token=...`, sans ancien portail a onglets.
- Alias internes confirmes: `IntervenantPortalV2Page.tsx` et `IntervenantPortalV2StrictPage.tsx` exportent aussi `EmployeePortalV2Page`.
- Fichier actif confirme: `EmployeePortalV2Page.tsx` exporte `EmployeePortalFieldV2Page.tsx`.
- Les anciens fichiers `IntervenantPortalV2CompletePage`, `IntervenantPortalV2FinalPage`, `IntervenantPortalFieldV2Page`, `IntervenantPortalTerrainV2Page` et `EmployeeFieldPortalV2Page` ne sont pas dans le flux route actuel.
- Controle CI confirme: le commit de stabilisation interne `/portail/employe?token=...` `4ce5f2637a1a80f9cf7b4444094f0fa815230dac` est passe Vercel `success`.
- Le fichier versionne `build-output.txt` sur `dev` montre un `npm run build` reussi avec generation du bundle `IntervenantPortalPage`.
- Le clone GitHub et le raw GitHub restent bloques dans l'environnement agent par proxy `403`, donc le build local ne peut pas etre relance ici.

## Notes ops

- Verifier les variables Vercel Preview/Production necessaires, sans exposer de secret, uniquement si un futur deploiement echoue
- `supabase db push` doit rester manuel depuis un poste avec acces reseau direct Supabase
- Ne pas appliquer automatiquement de SQL/RLS depuis l'agent
- Ne pas reconstruire le portail intervenant sans cause code prouvee ou validation produit explicite