# Cartographie des pages Batipro

Audit etabli avant refonte page par page. Les pages actives ne doivent pas etre refondues sans etape dediee.

## Architecture de routage

- Batipro utilise React Router, pas Next.js App Router ni Pages Router.
- Le shell applicatif protege est porte par `RequireAuth` et `LayoutShell`.
- Les routes CRM restent orchestrees par `CrmPage`, avec sections extraites dans `src/features/crm/pages`.
- Les modales metier ne sont pas routees ; elles sont gerees par etat local dans les pages.
- Le workspace devis est charge en lazy route via `CrmQuoteWorkspacePage`.

## Routes actives

| Module | Route | Composant |
| --- | --- | --- |
| Auth | `/` | `AppEntryPage` |
| Auth | `/login` | `AuthPage` |
| Intervenant public | `/acces/:token` | `IntervenantAccessPage` |
| Intervenant public | `/intervenant/invitation` | `IntervenantInvitationPage` |
| Intervenant public | `/intervenant` | `IntervenantPortalPage` |
| Dashboard | `/dashboard` | `DashboardPage` |
| CRM | `/crm` | `CrmPage` |
| CRM | `/crm/prospects` | `CrmPage` |
| CRM | `/crm/clients` | `CrmPage` |
| CRM | `/crm/opportunites` | `CrmPage` |
| CRM | `/crm/devis` | `CrmPage` |
| CRM Devis | `/crm/devis/:id/edit` | `CrmQuoteWorkspacePage` |
| CRM | `/crm/factures` | `CrmPage` |
| CRM | `/crm/achats` | `CrmPage` |
| CRM | `/crm/contacts` | `CrmPage` |
| CRM | `/crm/ressources` | `CrmPage` |
| CRM | `/crm/bibliotheque` | `CrmPage` |
| CRM | `/crm/agenda` | `CrmPage` |
| CRM | `/crm/sav` | `CrmPage` |
| CRM | `/crm/statistiques` | `CrmPage` |
| CRM | `/crm/parametres` | `CrmPage` |
| Chantiers | `/chantiers` | `ChantiersPage` |
| Chantiers | `/chantiers/nouveau` | `ChantierNewPage` |
| Fiche chantier | `/chantiers/:id` | `ChantierPage` |
| Visites chantier | `/chantiers/:id/visites` | `ChantierVisitesPage` |
| Intervenants | `/intervenants` | `IntervenantsPage` |
| Intervenants | `/intervenants/:id` | `IntervenantDetailPage` |
| Retours terrain | `/retours-terrain` | `TerrainFeedbacksPage` |
| Bibliotheque | `/bibliotheque` | `BibliothequeTasksPage` |
| Statistiques | `/statistiques` | `StatistiquesPage` |
| Entreprise | `/entreprise` | `MonEntreprisePage` |
| Entreprise | `/entreprise/fonctionnalites` | `MonEntreprisePage` |
| Entreprise | `/entreprise/profils` | `MonEntreprisePage` |
| Fournisseurs | `/fournisseurs` | `FournisseursPage` |
| Fournisseurs | `/entreprise/fournisseurs` | Redirect vers `/fournisseurs` |
| Fallback | `*` | `AppEntryPage` |

## Pages deplacees en deprecated

Ces fichiers n'etaient importes ni par les routes, ni par les composants actifs, ni par des lazy imports.

| Ancien fichier | Nouveau fichier | Motif |
| --- | --- | --- |
| `src/pages/HomePage.tsx` | `src/pages/deprecated/HomePage.tsx` | Page de test non routee. |
| `src/pages/ComingSoonPage.tsx` | `src/pages/deprecated/ComingSoonPage.tsx` | Placeholder non route. |
| `src/pages/BibliothequePage.tsx` | `src/pages/deprecated/BibliothequePage.tsx` | Ancienne bibliotheque documents, remplacee par `/bibliotheque`. |
| `src/pages/ChantierDetailsPage.tsx` | `src/pages/deprecated/ChantierDetailsPage.tsx` | Ancienne fiche chantier, remplacee par `ChantierPage`. |
| `src/pages/LoginPage.tsx` | `src/pages/deprecated/LoginPage.tsx` | Ancien login, remplace par `AuthPage`. |

## Doublons identifies

- `LoginPage` doublonne `AuthPage`.
- `BibliothequePage` doublonne partiellement `BibliothequeTasksPage`.
- `ChantierDetailsPage` doublonne `ChantierPage`.
- `/entreprise/fournisseurs` est une route historique redirigee vers `/fournisseurs`.
- `/entreprise`, `/entreprise/fonctionnalites` et `/entreprise/profils` partagent `MonEntreprisePage`.
- Les routes CRM partagent encore `CrmPage` comme orchestrateur, mais les vues principales sont maintenant extraites.

## TODO navigation CRM secondaire

- Contacts : a fusionner avec clients/prospects si la page ne porte pas une valeur metier distincte.
- Ressources : clarifier le perimetre avant exposition dans la navigation.
- Bibliotheque CRM : fusionner avec la Bibliotheque globale si aucun referentiel CRM dedie n'est maintenu.
- Parametres CRM : deplacer dans Parametres / Mon entreprise pour eviter un doublon de configuration.

## Decoupage CRM realise

Structure ajoutee :

- `src/features/crm/pages` : sections dashboard, prospects, clients, opportunites, devis, factures, achats, contacts, ressources, bibliotheque, agenda, SAV, statistiques et parametres.
- `src/features/crm/components` : header, navigation, badges, etats vides, helpers de formatage, shell de liste.
- `src/features/crm/hooks` : base de hooks CRM preparee pour l'etape suivante.
- `src/features/crm/types` : types de section et de modale CRM.
- `src/features/crm/forms` : formulaires prospects, clients, opportunites, devis, taches, RDV, SAV, documents, factures et achats.
- `src/features/crm/dialogs` : dialogs CRM dedies, dont l'ancien moteur modal de chiffrage.

`CrmPage` conserve temporairement :

- chargement principal des donnees CRM ;
- actions Supabase ;
- choix de la section active ;
- ouverture/fermeture des dialogs ;
- callbacks transmis aux dialogs.

Les dialogs CRM sont lazy-loades depuis `CrmPage`. Le lazy-loading des sections CRM reste reporte pour limiter le risque de regression sur les routes principales.

## Pages monolithiques critiques

| Composant | Risque |
| --- | --- |
| `CrmPage` | Sections, formulaires et dialogs extraits. Reste a sortir les actions Supabase et le chargement des donnees. |
| `ChantierPage` | Structure feature creee et onglets deja externalises branches via `src/features/chantiers/pages`. Les gros onglets inline restent a decouper. |
| `IntervenantPortalPage` | Structure feature creee, sections principales encapsulees et carte chantier/etat vide extraits. Reste a sortir le state et les mutations. |

## Decoupage chantier realise

Structure ajoutee :

- `src/features/chantiers/pages` : wrappers de sections chantier pour planning, budget, achats, photos, messagerie, rapports, DOE, visites, preparation, localisation, notes et pilotage.
- `src/features/chantiers/components` : navigation d'onglets, badge statut, cartes de synthese et etat vide.
- `src/features/chantiers/dialogs` : placeholders de dialogs chantier pour extraction future.
- `src/features/chantiers/hooks` : placeholders de hooks chantier pour extraction future.
- `src/features/chantiers/types` : type partage des onglets chantier.

`ChantierPage` conserve temporairement :

- chargement du chantier et des donnees associees ;
- actions Supabase ;
- drawers et formulaires inline ;
- onglets encore tres lies au state local : taches/devis, temps, intervenants, documents, reserves, consignes, materiel.

Le rendu utilisateur des onglets existants n'a pas ete refondu.

### Step 5.1

- `ChantierJournalSection` est extrait completement avec props.
- Les onglets `taches/devis`, `temps`, `intervenants`, `documents`, `reserves`, `consignes` et `materiel` sont encapsules dans leurs composants section dedies.
- Ces wrappers contiennent un TODO explicite lorsque l'extraction complete depend encore de la separation du state metier de `ChantierPage`.

## Decoupage portail intervenant realise

Structure ajoutee :

- `src/features/intervenant-portal/pages` : sections dashboard, chantiers, detail chantier, taches, temps, planning, documents, materiel, messages, consignes, reserves, retours terrain, profil et etat vide.
- `src/features/intervenant-portal/components` : header placeholder, carte chantier, carte tache placeholder, badge statut et etat vide.
- `src/features/intervenant-portal/dialogs` : placeholders pour feedback et photo.
- `src/features/intervenant-portal/hooks` : placeholders de hooks data/actions.
- `src/features/intervenant-portal/types` : type partage des tabs du portail.

`IntervenantPortalPage` conserve temporairement :

- authentification/token intervenant ;
- chargement des chantiers, taches, documents, temps, materiel, consignes, reserves et retours ;
- mutations offline/online ;
- state mobile ;
- formulaires temps, materiel, messages et retours terrain.

Les panneaux principaux sont encapsules sans changement visuel. La carte chantier desktop et l'etat vide sans chantier sont extraits.

## Prochaines refontes recommandees

1. Deplacer progressivement les actions CRM vers `useCrmActions`.
2. Deplacer le chargement dataset vers `useCrmData` quand les tests CRM seront stabilises.
3. Lazy-loader les sections CRM les plus lourdes apres validation fonctionnelle.
4. Extraire le state metier des onglets chantier dans des hooks dedies, en commencant par `journal`, `documents`, `intervenants`, puis `temps`.
5. Deplacer le JSX complet des wrappers chantier lorsque le state correspondant sera sorti de `ChantierPage`.
6. Extraire le chargement et les mutations du portail intervenant vers `useIntervenantPortalData` et `useIntervenantPortalActions`.
7. Extraire les drawers chantier vers `src/features/chantiers/dialogs`.
8. Stabiliser `CrmQuoteWorkspacePage` comme workspace devis unique.
9. Harmoniser les routes entreprise en conservant les redirections historiques.
10. Supprimer definitivement les fichiers deprecated apres une release stable et validation production.
