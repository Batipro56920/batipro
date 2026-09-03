-- Les photos et pièces jointes envoyées depuis le fil chantier (bureau et
-- portail ouvrier) étaient enregistrées avec la catégorie "Fil chantier",
-- une valeur qui n'existe pas dans la liste de catégories utilisée par
-- l'onglet Documents (Administratif/Plans/Fiches techniques/Photos/PV/
-- VISITE/DOE/Rapports/Divers). Résultat : ces fichiers étaient invisibles
-- des filtres par catégorie du chantier, impossibles à retrouver autrement
-- qu'en faisant défiler tout le fil chantier.
--
-- Corrige les documents déjà envoyés ; les nouveaux envois utilisent
-- désormais directement la bonne catégorie (voir chantierFeed.service.ts et
-- la fonction edge intervenant-chantier-feed-upload).

update public.chantier_documents
set category = case when document_type = 'PHOTO' then 'Photos' else 'Divers' end
where category = 'Fil chantier';
