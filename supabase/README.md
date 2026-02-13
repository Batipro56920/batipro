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

## Notes sécurité
- `chantier-access-admin` et `generate-intervenant-link` vérifient **role=ADMIN** via `profiles` ou email autorisé.
- `link-intervenant-user` lie un user à un intervenant **uniquement** si l'email du token correspond.
