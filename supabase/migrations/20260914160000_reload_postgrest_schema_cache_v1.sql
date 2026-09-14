-- Recharger le cache de schéma de PostgREST.
--
-- PostgREST garde en mémoire la liste des colonnes. Juste après un ALTER TABLE,
-- une colonne qui existe vraiment peut être refusée avec "could not find the
-- column ... in the schema cache" : c'est ce qui faisait disparaître, sans
-- aucun message, le coût horaire et la marge saisis sur une tâche.

notify pgrst, 'reload schema';
