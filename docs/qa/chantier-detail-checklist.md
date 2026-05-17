# QA - Fiche chantier

## Routes

- [ ] `/chantiers/:id` affiche Vue d'ensemble.
- [ ] `/chantiers/:id/preparation` affiche Préparation.
- [ ] `/chantiers/:id/production` affiche Production.
- [ ] `/chantiers/:id/financier` affiche Financier.
- [ ] `/chantiers/:id/qualite-cloture` affiche Qualité / Clôture.
- [ ] `/chantiers/:id/execution` redirige vers `/production`.
- [ ] `/chantiers/:id/qualite-sav` redirige vers `/qualite-cloture`.
- [ ] `/chantiers/:id/crm` redirige vers `/chantiers/:id`.
- [ ] `/chantiers/:id/historique` redirige vers `/chantiers/:id`.

## Navigation

- [ ] La navigation principale contient uniquement Vue d'ensemble, Préparation, Production, Financier, Qualité / Clôture.
- [ ] CRM n'apparaît plus dans la navigation principale.
- [ ] Historique n'apparaît plus dans la navigation principale.
- [ ] Aucune sous-navigation horizontale secondaire n'est affichée.
- [ ] Le breadcrumb affiche `Chantiers > Nom chantier > Section`.

## Pages

- [ ] Vue d'ensemble affiche les infos chantier, alertes, budget résumé, CRM court et activité récente.
- [ ] Préparation affiche localisation, intervenants, documents, consignes, matériel et approvisionnement.
- [ ] Production affiche tâches, planning, temps, photos, messagerie, réserves ouvertes et journal.
- [ ] Financier affiche budget, achats, imprévus et rapports.
- [ ] Qualité / Clôture affiche réserves, visites, DOE et SAV/conformité si disponibles.

## Non-régression

- [ ] Les actions header restent accessibles.
- [ ] Les permissions existantes masquent les modules non autorisés.
- [ ] Les services/API ne sont pas modifiés.
- [ ] Responsive desktop/tablette/mobile correct.
- [ ] `npm run build` passe.

