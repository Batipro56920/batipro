# Guide utilisateur - Catalogue produits

Le catalogue produits centralise les produits, prix fournisseurs, documents techniques et prix de reference.

## Fiche produit

Chaque produit contient :

- designation ;
- reference interne ;
- reference fabricant ;
- marque ;
- categorie ;
- unite ;
- TVA ;
- fournisseur principal ;
- prix achat standard ;
- prix vente conseille ;
- marge cible.

## Prix negocies fournisseurs

Un produit peut avoir plusieurs prix negocies :

- fournisseur ;
- prix HT negocie ;
- remise ;
- date de debut ;
- date de fin ;
- conditionnement ;
- quantite minimum ;
- delai livraison.

Le meilleur prix valide peut etre repris automatiquement dans un bon de commande.

## Documents lies

Documents prevus :

- fiche technique ;
- notice ;
- FDS ;
- certification ;
- photo.

## Recherche et filtres

La page permet de filtrer par :

- categorie ;
- fournisseur ;
- marque ;
- tranche de prix.

## Bons de commande

Depuis un bon de commande fournisseur, la zone Catalogue produits permet d'inserer un produit.

Batipro recupere automatiquement :

- fournisseur principal ou fournisseur selectionne ;
- prix HT negocie si disponible ;
- prix achat standard sinon ;
- TVA ;
- unite ;
- reference interne / fabricant en note interne.

Le prix reste modifiable manuellement dans le bon de commande.

## Historique prix

La V1 conserve une base d'historique prix locale a la creation du produit. La prochaine etape backend pourra historiser chaque changement de prix fournisseur.
