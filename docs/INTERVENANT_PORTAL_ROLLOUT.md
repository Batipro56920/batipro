# Portail Intervenant - Rollout V2

## Flow actif

- Flow principal: `/intervenant?token=...`
- Token opaque stocke en base (`public.chantier_access`)
- Validation via RPC SQL `SECURITY DEFINER`
- Cote intervenant: acces via RPC uniquement (pas de JWT custom client)

## Compat legacy

- `/acces/:token` reste disponible uniquement en fallback
- Fallback active seulement si `VITE_ENABLE_INTERVENANT_LEGACY_FALLBACK=1`
- Par defaut: fallback desactive

## Migration principale

- `supabase/migrations/20260222173000_intervenant_portal_multi_chantiers_v2.sql`

Cette migration versionne:

- multi-chantiers par token dans `chantier_access`
- RPC admin/intervenant (session, chantiers, taches, documents, planning, temps, materiel)
- table `chantier_task_comments`
- table `chantier_time_entries`
- hardening RLS phase 1 pour `chantier_access`
- alignement schema materiel (`statut`: `en_attente|validee|refusee|livree`)

## UI livree

### Intervenant `/intervenant`

- Onglets: `Chantiers`, `Taches`, `Temps`, `Planning`, `Documents`, `Materiel`
- Multi-chantiers: selection chantier + persistance locale du dernier chantier
- Loading / error / empty par onglet
- Actions:
  - Taches: mise a jour statut + commentaire
  - Temps: creation + listing
  - Materiel: creation + suivi statut
- Mobile iPhone:
  - `min-h-[100dvh]`
  - `pt/pb` safe-area
  - tabs en scroll horizontal

### Admin `ChantierPage` (Materiel)

- Filtre par statut (`Tous`, `En attente`, `Validee`, `Refusee`, `Livree`)
- Actions par demande: `Valider`, `Refuser`, `Livree`
- Commentaire admin editable

## Checklist smoke tests

1. Token valide sur Safari iPhone (normal)
2. Token valide sur Safari iPhone (prive)
3. Token invalide/expire/revoque
4. Token avec 1 chantier
5. Token avec plusieurs chantiers + switch chantier
6. Taches: listing + changement statut + ajout commentaire
7. Temps: creation + recharge liste
8. Documents: lecture seule
9. Planning: lecture lots + dates
10. Materiel intervenant: creation + statut visible
11. Materiel admin: filtre + valider/refuser/livree + commentaire

## Notes ops

- Redeployer Vercel apres merge
- Verifier `VITE_PUBLIC_APP_URL` en `Production/Preview/Development`
- `supabase db push` doit etre execute depuis un poste avec acces reseau direct Supabase
