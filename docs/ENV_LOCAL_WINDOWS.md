# Configuration locale Windows (PowerShell)

## Objectif

Le lien intervenant est genere uniquement avec `VITE_PUBLIC_APP_URL`.

Format final:

`https://<DOMAINE-VERCEL>/intervenant?token=...`

Il n'y a aucun fallback vers `window.location.origin`.

## Methode recommandee (persistante)

Creer/mettre a jour le fichier `.env.local` a la racine du projet:

```env
VITE_PUBLIC_APP_URL=https://<DOMAINE-VERCEL>
```

Puis redemarrer Vite:

```powershell
npm run dev
```

## Methode temporaire PowerShell (session courante)

```powershell
$env:VITE_PUBLIC_APP_URL="https://<DOMAINE-VERCEL>"
npm run dev
```

## Important

Cette syntaxe ne fonctionne PAS dans PowerShell:

```powershell
VITE_PUBLIC_APP_URL=https://<DOMAINE-VERCEL>
```

PowerShell interprete cela comme une commande, pas comme une variable d'environnement.

## Vercel

Ajouter `VITE_PUBLIC_APP_URL` dans **Project Settings > Environment Variables**
pour `Production`, `Preview` (et `Development` si besoin), puis redeployer.

## Fallback legacy (temporaire)

Le portail principal est `/intervenant?token=...`.

Pour garder temporairement la compatibilite avec `/acces/:token` en cas de RPC manquante:

```env
VITE_ENABLE_INTERVENANT_LEGACY_FALLBACK=1
```

Pour desactiver ce fallback:

```env
VITE_ENABLE_INTERVENANT_LEGACY_FALLBACK=0
```
