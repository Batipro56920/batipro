# Déploiement Edge Functions

Ce projet force `verify_jwt = false` pour certaines Edge Functions afin d'éviter le toggle "Verify JWT with legacy secret".
La sécurité est assurée **dans le code** (vérification Authorization + rôle admin).

## Fonctions concernées
- `chantier-access-admin`
- `generate-intervenant-link`
- `link-intervenant-user`

## Configuration
Dans `supabase/config.toml`, chaque fonction est configurée avec:
```
verify_jwt = false
```

## Fichiers d'environnement

Le fichier `supabase/functions/.env` est un fichier local sensible et ne doit jamais etre versionne.
Utiliser uniquement `supabase/functions/.env.example` comme modele sans valeurs secretes.

En local, creer `supabase/functions/.env` avec les vraies valeurs uniquement sur la machine du proprietaire.
En production, configurer les secrets avec les commandes Supabase ou depuis le tableau de bord Supabase, par exemple:

```bash
supabase secrets set SUPABASE_URL=...
supabase secrets set SUPABASE_ANON_KEY=...
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...
```

Ne jamais exposer `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `DOCUMENT_TOKEN_SECRET`, `OPENAI_API_KEY` ou `RESEND_API_KEY` dans le front-end Vite.

## Déploiement
Déployer uniquement les fonctions concernées:
```
npm run supabase:deploy:functions
```

Ou déployer toutes les fonctions sans vérification JWT:
```
npm run supabase:deploy:all
```

## Secrets requis (Supabase)
Ces fonctions nécessitent:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PUBLIC_APP_URL` (pour les liens d'accès)

Optionnel pour la sécurité admin:
- `ADMIN_EMAILS` ou `VITE_ADMIN_EMAILS` (liste séparée par virgule)

Secrets complémentaires selon fonctions activées:
- `SUPABASE_JWT_SECRET` ou `JWT_SECRET`
- `DOCUMENT_TOKEN_SECRET`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`

## Notes sécurité
- `chantier-access-admin` et `generate-intervenant-link` vérifient **role=ADMIN** via `profiles` ou email autorisé.
- `link-intervenant-user` lie un user à un intervenant **uniquement** si l'email du token correspond.
