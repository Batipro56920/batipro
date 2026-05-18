# PV de réception chantier

Le module PV de réception permet de préparer le document de fin de chantier depuis la fiche chantier, dans l’espace `Qualité`.

## Utilisation

1. Ouvrir un chantier.
2. Aller dans `Qualité`.
3. Remplir le bloc `PV de réception`.
4. Choisir la décision :
   - réception sans réserve ;
   - réception avec réserves ;
   - refus de réception.
5. Ajouter les observations libres.
6. Importer les réserves chantier existantes ou créer des réserves propres au PV.
7. Renseigner les signataires client et entreprise.
8. Enregistrer, prévisualiser ou générer le PDF.

## Réserves

Chaque réserve contient :

- description ;
- lot concerné ;
- responsable ;
- date prévue de levée ;
- statut ouverte ou levée.

Les réserves importées depuis le suivi chantier conservent une référence interne vers la réserve d’origine.

## Envoi et signature

Le bouton `Envoyer` ouvre le workflow document-engine existant. La signature électronique est préparée dans le modèle avec les zones client et entreprise, et devra être reliée au futur lien client sécurisé.

## Données

La V1 stocke les PV localement côté navigateur via la couche repository du module. Une persistance Supabase dédiée pourra être ajoutée ensuite sans changer l’interface.
