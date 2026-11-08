---
name: batipro-review
description: Auditer une modification, un correctif, une branche ou une pull request Batipro avant intégration ; rechercher régressions, erreurs TypeScript, défauts RLS, risques et résultats de tests.
---

# Revue indépendante Batipro
1. Lire AGENTS.md, le diff effectif et les zones du code appelant/consommateur.
2. Faire intervenir l'auditeur en lecture seule pour les travaux significatifs ; maintenir un regard indépendant de l'implémenteur.
3. Rechercher d'abord les défauts fonctionnels, de sécurité, de données et de migrations ; puis les faiblesses de typage et d'expérience utilisateur.
4. Exécuter si disponible git diff --check, recherche de marqueurs de conflit, TypeScript, lint ciblé, npm run build et tests applicables.
5. Classer chaque défaut par sévérité avec chemin, emplacement, comportement observé ou scénario concret.
6. Distinguer problèmes existants, nouveaux problèmes et vérifications non exécutées. Ne jamais dire « validé » sans preuves.
7. Donner une conclusion de risque, les corrections indispensables et le statut de préparation de PR, sans fusionner ni déployer.
