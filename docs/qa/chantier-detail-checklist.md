# QA - Fiche chantier

## Routes

- [ ] `/chantiers/:id` affiche Cockpit.
- [ ] `/chantiers/:id/preparation` affiche Preparation.
- [ ] `/chantiers/:id/execution` affiche Execution.
- [ ] `/chantiers/:id/financier` affiche Financier.
- [ ] `/chantiers/:id/qualite` affiche Qualite.
- [ ] `/chantiers/:id/documents` affiche Documents.
- [ ] `/chantiers/:id/equipe` affiche Equipe.
- [ ] `/chantiers/:id/sav` affiche SAV.
- [ ] `/chantiers/:id/historique` affiche Historique.
- [ ] `/chantiers/:id/production` redirige vers `/execution`.
- [ ] `/chantiers/:id/qualite-cloture` redirige vers `/qualite`.
- [ ] `/chantiers/:id/qualite-sav` redirige vers `/qualite`.
- [ ] `/chantiers/:id/crm` redirige vers le cockpit.

## Navigation

- [ ] La navigation principale contient uniquement Cockpit, Preparation, Execution, Financier, Qualite, Documents, Equipe, SAV, Historique.
- [ ] CRM n'apparait plus dans la navigation chantier.
- [ ] Il n'y a pas de sous-navigation secondaire visible.
- [ ] Le breadcrumb affiche `Chantiers > Nom chantier > Section`.
- [ ] Les actions header ouvrent les sections ou drawers pertinents.

## Sections

- [ ] Cockpit affiche une synthese unique sans bloc CRM complet.
- [ ] Preparation affiche checklist, localisation, intervenants, materiel, consignes et approvisionnement critique.
- [ ] Execution affiche taches, planning, temps, photos, messagerie, notes et reserves ouvertes.
- [ ] Financier affiche budget, achats, imprevus, travaux supplementaires, marge et rapports.
- [ ] Qualite affiche reserves, visites, controles et DOE.
- [ ] Documents affiche la bibliotheque documentaire chantier.
- [ ] Equipe affiche les intervenants affectes.
- [ ] SAV affiche les tickets post-production et permet de creer un ticket.
- [ ] Historique affiche le journal complet sans doublon avec Execution.

## Non-regression

- [ ] Les services/API existants ne sont pas modifies.
- [ ] Les permissions existantes masquent les modules non autorises.
- [ ] Les actions sensibles existantes restent disponibles.
- [ ] Responsive desktop/tablette/mobile correct.
- [ ] `npm run build` passe.
