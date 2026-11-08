---
name: batipro-supabase-change
description: Examiner et préparer une modification de schéma, migration, politique RLS ou Edge Function Supabase dans Batipro. Utiliser dès qu'une demande implique PostgreSQL, authentification, stockage, permission ou données persistantes.
---

# Modification Supabase sûre
1. Lire AGENTS.md et le Skill existant supabase-postgres-best-practices ; inspecter les migrations et le code consommateur.
2. Identifier clairement schéma actuel, migration cible et migrations potentiellement déjà appliquées. Ne jamais réécrire une migration appliquée.
3. Préparer une migration additive ou corrective avec impact sur données, index, contraintes et compatibilité du front.
4. Examiner les politiques RLS avec principe du moindre privilège ; durcir toute fonction security definer via search_path explicite approprié.
5. Vérifier les signatures et les permissions des Edge Functions, les attentes JWT et les secrets requis sans afficher leurs valeurs.
6. Prévoir un plan de vérification et de retour arrière. Faire contrôler le diff par l'auditeur.
7. Ne jamais appliquer une migration distante ou déployer une Edge Function sans autorisation explicite.
