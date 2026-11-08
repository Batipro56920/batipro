# Batipro — instructions communes Codex

Application de production React 19, TypeScript, Vite, Supabase et Vercel. Utiliser le français pour les comptes rendus.

## Avant toute intervention
- Lire ce fichier, les Skills concernés, les fichiers touchés et les conventions existantes.
- Inspecter la branche, le statut Git, les commits récents et le diff. Ne jamais travailler directement sur main.
- Définir le périmètre. Garder Supabase comme source de vérité des données métier persistantes.
- Décomposer uniquement les travaux véritablement indépendants en sous-agents. Ne pas démarrer cinq agents pour une correction simple.
- Séparer exploration/architecture/tests/revue, et attribuer la modification d'un fichier à un seul agent à la fois.

## Coordination
- Responsable principal : planifier, dispatcher, recueillir les résultats, intégrer, valider, rendre compte.
- Architecte : conception et dépendances, recommandations sans modifier le code par défaut.
- Développeur React : UI et logique métier typée, sans accès aux migrations par défaut.
- Expert Supabase : schémas, RLS, Edge Functions et migrations, sans déploiement.
- Testeur : tests ciblés, typecheck, lint, build, reproduction des régressions.
- Auditeur : revue indépendante en lecture seule, risques sécurité et intégration.
- Faire intervenir l'auditeur après les changements, en lui fournissant le diff et non les seules explications du développeur.

## Invariants
- Ne pas utiliser querySelector, recherche de libellés ou setter DOM impératif pour contourner React ; utiliser état React, props et services typés.
- Ne pas masquer les erreurs TypeScript en élargissant les types à unknown/any ou en désactivant des contrôles.
- Ne pas introduire de seconde source de vérité localStorage à côté de Supabase.
- Ne jamais réécrire une migration déjà appliquée. Créer une migration corrective, vérifier RLS et search_path des fonctions security definer.
- Ne jamais divulguer de clé service_role, secret, fichier .env ou données clients.
- Conserver les fonctionnalités de main ; résoudre les conflits en intégrant les comportements, pas en choisissant aveuglément ours/theirs.
- Ne jamais lancer de push, fusion sur main, migration distante, fonction Edge distante ni déploiement production sans accord explicite.

## Contrôles avant proposition de PR
1. git diff --check et recherche des marqueurs de conflit.
2. npx tsc --noEmit -p tsconfig.app.json (si ce tsconfig existe) ; sinon npm run build.
3. ESLint ciblé sur les fichiers modifiés.
4. npm run build.
5. Vérification des secrets dans le diff et des migrations si concernées.
6. Revue indépendante pour toute modification complexe ou sensible.

Ne pas prétendre avoir exécuté des contrôles si l'environnement ne le permet pas. Signaler les échecs préexistants séparément. Préférer une PR brouillon non fusionnée, et demander approbation avant toute action distante non indispensable.
