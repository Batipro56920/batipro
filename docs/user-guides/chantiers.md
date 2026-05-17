# Guide utilisateur - Chantiers

La page **Production chantier** sert de cockpit opérationnel pour suivre les chantiers actifs, terminés, archivés ou annulés.

## Indicateurs

- **Chantiers actifs** : chantiers en préparation, en cours ou en pause.
- **En préparation** : chantiers à lancer.
- **En retard** : chantiers dont l'échéance est dépassée.
- **Alertes** : retards ou dépassements de temps détectés.
- **Terminés ce mois** : chantiers clôturés sur le mois courant.
- **Marge estimée** : estimation basée sur le devis signé et les budgets prévisionnels disponibles.

## Recherche et filtres

La recherche accepte un nom de chantier, client ou adresse. Les filtres permettent de limiter l'affichage par statut, client et période. Les filtres responsable et type chantier sont préparés mais désactivés tant que les données correspondantes ne sont pas reliées.

## Vues

- **Liste** : vue compacte pour piloter rapidement les chantiers.
- **Cartes** : vue synthétique orientée suivi production.
- **Planning** : vue chronologique des échéances.
- **Kanban** : regroupement par préparation, en cours, blocage et terminé.

## Actions

- **Ouvrir** : accède à la fiche chantier complète.
- **Terminer** : demande confirmation puis marque le chantier comme terminé.
- **Archiver** : demande confirmation puis archive le chantier.
- **Annuler** : demande confirmation puis exclut le chantier du pilotage.
- **Restaurer** : remet un chantier terminé, archivé ou annulé en cours.
- **Export** : exporte le chantier en CSV.
- **Supprimer** : demande confirmation et reste disponible uniquement pour les brouillons, si la suppression logique est supportée.

## Règles d'affichage

- Si aucun budget n'est renseigné ou si le montant vaut 0, la page affiche **Budget non renseigné**.
- Si aucun temps prévu et aucun temps consommé ne sont renseignés, la page affiche **Temps non planifié**.
- Les échéances dépassées sont indiquées avec le libellé **En retard**.

## Drawer rapide

Un clic sur une ligne ou une carte ouvre un aperçu rapide avec les onglets Vue rapide, Tâches, Équipe, Documents et Alertes. Les onglets détaillés renvoient vers la fiche chantier complète lorsque les données détaillées ne sont pas disponibles dans la liste.
