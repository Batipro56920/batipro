---
name: batipro-feature
description: Développer ou modifier une fonctionnalité Batipro avec un workflow coordonné React, TypeScript, Supabase et vérification. Utiliser pour une nouvelle page, un module, un workflow métier ou une refonte impliquant plusieurs fichiers.
---

# Développement d'une fonctionnalité Batipro
1. Lire AGENTS.md et examiner les modules existants avant de proposer une solution.
2. Expliciter la demande, les données persistées, les profils concernés et les parcours touchés.
3. Solliciter l'architecte pour une modification transverse ; confier React et Supabase à des agents distincts uniquement si leurs fichiers ne se chevauchent pas.
4. Réutiliser composants, styles, services et modèles existants. Maintenir les textes UI en français.
5. Ne pas dupliquer les sources de vérité ; persister les données métier dans Supabase et maintenir les types stricts.
6. Exécuter la validation indiquée par AGENTS.md. Solliciter le testeur puis l'auditeur pour les changements importants.
7. Produire une synthèse avec fichiers changés, tests exécutés, risques et actions restant soumises à approbation. Ne jamais déployer en production automatiquement.
