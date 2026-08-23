# Charte UX/UI Batipro — v2

Spécification exploitable du design system Batipro. Source de vérité technique : `src/design-system/theme/theme.css`.

Déploiement **bloc par bloc** : fondations → écran pilote (Dashboard) → validation utilisateur → écran suivant. Aucun écran n'est migré sans validation visuelle préalable.

---

## 1. Design tokens

Aucun composant ne référence `slate-200`, `blue-600`, `bg-white`. Tout passe par des tokens sémantiques exposés à Tailwind v4 via `@theme inline` (obligatoire : sans `inline`, la valeur est figée au build et le thème ne suit plus).

| Token | Utilitaire | Light | Dark | Rôle |
|---|---|---|---|---|
| `--bt-bg-app` | `bg-app` | `#F4F6FA` | `#0B111C` | fond de la zone de contenu |
| `--bt-bg-sidebar` | `bg-sidebar` | `#0F2747` | `#0B1526` | navigation latérale (navy Batipro) |
| `--bt-bg-surface` | `bg-surface` | `#FFFFFF` | `#131B2A` | listes, tableaux, formulaires |
| `--bt-bg-elevated` | `bg-elevated` | `#FFFFFF` | `#1A2333` | popover, menu, drawer, toast |
| `--bt-bg-interactive` | `bg-interactive` | `#EFF3F9` | `#1F2A3C` | hover de ligne, piste de jauge |
| `--bt-bg-selected` | `bg-selected` | `#E9F1FE` | `#16294A` | ligne active, nav active |
| `--bt-border-subtle` | `border-subtle` | `#E4E9F0` | `#223047` | séparateurs, contour de surface |
| `--bt-border-strong` | `border-strong` | `#C9D3E0` | `#33445F` | champs, contours affirmés |
| `--bt-text-primary` | `text-ink` | `#0B1220` | `#EAF0F8` | titres, valeurs |
| `--bt-text-secondary` | `text-ink-secondary` | `#35435A` | `#AFBDD0` | corps de texte |
| `--bt-text-muted` | `text-muted` | `#5E6C82` | `#8494AB` | labels, métadonnées |
| `--bt-primary` | `bg-primary` / `text-primary` | `#2563EB` | `#4C8DFF` | action, sélection |
| `--bt-primary-hover` | `bg-primary-hover` | `#1D4FD8` | `#6BA1FF` | survol |
| `--bt-primary-contrast` | `text-primary-contrast` | `#FFFFFF` | `#08111F` | texte **sur** primary |
| `--bt-primary-soft` / `-on-soft` | `bg-primary-soft` / `text-primary-on` | `#E8F0FE` / `#1A4FC4` | `#132444` / `#93BAFF` | accent doux |

**Statuts** — chacun a trois valeurs : `solid` (traits, points, jauges), `soft` (fond de chip), `on` (texte sur soft).

| Statut | Light solid / soft / on | Dark solid / soft / on |
|---|---|---|
| success | `#16A34A` / `#E7F6EC` / `#15803D` | `#34C77B` / `#0F2A1E` / `#5FDCA0` |
| warning | `#D97706` / `#FDF1DC` / `#9A5B08` | `#E9A23B` / `#2A1F0E` / `#F0BE6E` |
| danger | `#DC2626` / `#FCE9E9` / `#B42318` | `#F26D6D` / `#2B1315` / `#FB9494` |
| info | `#0284C7` / `#E4F1FB` / `#0369A1` | `#48B8E8` / `#0C2430` / `#7BD0F2` |
| neutral | `#64748B` / `#F1F4F9` / `#44506B` | `#7A8AA0` / `#1C2637` / `#A7B5C8` |

Les anciennes variables de `src/index.css` (`--color-primary`, `--bt-surface`, …) sont conservées mais **aliasées** sur ces tokens : le CSS legacy des écrans non migrés suit le thème sans être réécrit.

## 2. Light + Dark + System

Trois modes : `light`, `dark`, `system`. Choix persisté dans `localStorage["batipro.theme"]` (seule préférence d'interface stockée localement ; aucune donnée métier — cf. `AGENTS.md`). `ThemeProvider` résout `system` via `matchMedia` et pose `.dark` + `data-theme` + `color-scheme` sur `<html>`. Un script inline dans `index.html` applique le thème **avant le premier rendu** : aucun flash de thème clair.

Le dark n'est pas une inversion : quatre paliers de surface réellement distincts (`#0B111C` → `#0B1526` → `#131B2A` → `#1A2333`), bordures visibles à `#223047`, statuts désaturés d'environ 15 % pour ne pas vibrer, accent `#4C8DFF` sur encre sombre `#08111F`. La sidebar reste navy dans les deux thèmes : c'est l'ancre d'identité Batipro.

États couverts dans les deux modes : fond global, sidebar, cartes, surfaces élevées, menus, drawers, champs, hover, selected, disabled.

## 3. Typographie

Inter, `font-feature-settings: "cv05","ss01"`. Tout montant, quantité, durée ou date en `tabular-nums` (classe `.bt-num`).

| Rôle | Classe | px / LH / weight / tracking |
|---|---|---|
| Page title | `.bt-page-title` | 24 / 30 / 650 / −0.02em |
| Section title | `.bt-section-title` | 16 / 22 / 620 / −0.01em |
| Card / list title | `.bt-card-title` | 14 / 20 / 600 / −0.005em |
| Body | — (défaut) | 14 / 20 / 400 |
| Secondary | `.bt-secondary` | 13 / 18 / 400 |
| Caption / meta | `.bt-caption` | 12 / 16 / 500 |
| Metric | `.bt-metric` | 22 / 26 / 650, tabulaire |
| Button | — | 14 / 20 / 500 (sm : 13) |
| Table / list metadata | `.bt-caption` + `text-muted` | 12 / 16 / 500, **jamais en capitales** |

Un seul niveau ≥ 20 px par page. Pas de `font-bold` hors page title. Les eyebrows `uppercase tracking-[0.22em]` sont supprimés : ils coûtent une ligne et n'apportent aucune information.

## 4. Espacement

Base 4 px. Padding de page : desktop 24 px (`md:p-6`), tablette 24 px, mobile 16 px. Largeur max de contenu 1440 px.

Gap entre sections majeures 20–24 px (`space-y-5 lg:space-y-6`) ; entre sections liées 12 px (`space-y-3`) ; padding interne de surface 16 px mobile / 20 px desktop ; **0 gap entre lignes de liste** (séparateur 1 px).

Hauteurs : ligne de liste 52 px minimum (`.bt-row`), contrôle 36 px (`.bt-control`). Sous `@media (pointer: coarse)` ces valeurs passent automatiquement à **64 px et 44 px** : le même écran est confortable à la souris et utilisable avec des gants sur chantier, sans page mobile séparée.

## 5. Radius / bordure / ombre — la règle des 3 niveaux

Radius : champ et bouton 8 px (`rounded-field`) · chip `rounded-full` · surface de contenu 12 px (`rounded-card`) · panneau et drawer 16 px (`rounded-surface`) · dialog 20 px. Jamais deux radius > 12 px imbriqués.

- **Niveau 0 — Section.** Pas de fond, pas de bordure, pas d'ombre. C'est le niveau **par défaut** : l'en-tête de page en relève.
- **Niveau 1 — Surface.** `bg-surface` + `border border-subtle` + `rounded-card`, **sans ombre**. Réservé au contenu qui forme une unité manipulable : liste, tableau, formulaire.
- **Niveau 2 — Elevated.** `bg-elevated` + `shadow-elevated` + bordure (indispensable en dark). Uniquement ce qui flotte au-dessus de la page.

Corollaire strict : **jamais un niveau 1 dans un niveau 1**. À l'intérieur d'une surface on sépare par `border-t border-subtle` ou par un changement de fond, jamais par une carte imbriquée. C'est ce qui supprime l'effet « mur de cartes indépendantes ».

## 6. Hiérarchie de l'information — 4 niveaux

Chaque écran classe ses données ainsi.

1. **Critique** — exige une action maintenant, visible sans interaction. Dashboard : les éléments de score ≥ 85 (tâche à reprendre, réserve urgente, approvisionnement en retard).
2. **Action** — utile aujourd'hui, visible mais après le critique. Dashboard : retards, validations, achats, matériel en attente.
3. **Contexte** — aide à décider, compact ou replié. Dashboard : liste des chantiers, activité commerciale.
4. **Détail** — à la demande uniquement (drawer, page, `title`, disclosure). Dashboard : motif d'une reprise, quantités, historique.

Une moyenne (avancement moyen, heures totales) n'est jamais de niveau 1 ou 2 : elle ne déclenche aucune action. Une donnée non branchée (`—`) ne s'affiche pas.

## 7. Actions

Une section = **une action primaire au maximum**. `primary` (bleu plein) pour l'action attendue ; `secondary` (surface bordée) pour l'alternative ; `ghost` (texte) pour le tertiaire ; `danger` réservé à la confirmation destructive finale — jamais un bouton rouge plein dans une barre d'outils. Au-delà de 2 actions secondaires visibles, le reste passe en menu overflow. Pas d'ombre colorée sur un bouton.

## 8. Cards / listes / tableaux

- **Liste** (défaut) dès que l'utilisateur compare des éléments de même nature. Une bonne ligne : trait de statut, titre, une ligne secondaire, une ou deux métadonnées, une action contextuelle.
- **Tableau** uniquement quand la comparaison colonne par colonne a du sens ; jamais forcé sur mobile, où il devient une liste.
- **Carte** seulement si le contenu est réellement indépendant. Ne jamais envelopper une métrique, une ligne ou un libellé dans une carte bordée.

## 9. Formulaires

Champ 36 px desktop / 44 px tactile, `rounded-field`, `bg-surface border border-strong`, focus `border-primary` + anneau 3 px. Label toujours visible en `.bt-caption` au-dessus du champ (jamais un placeholder seul). Aide en `text-muted`, erreur en `text-danger-on` sous le champ. Groupement par tâche, pas par structure de table. Desktop 2 colonnes maximum, mobile 1 colonne. `font-size: 16px` conservé sur mobile (anti-zoom iOS).

## 10. Drawer / modal / page

- **Inline** : édition courte qui ne casse pas le contexte.
- **Drawer** : inspection ou édition contextuelle où la page doit rester lisible derrière.
- **Modal** : décision focalisée ou formulaire très court uniquement.
- **Page complète** : workflow profond (devis, chantier, facture).

## 11. Navigation

Sidebar navy persistante, item actif en pastille blanche pleine. Navigation locale par onglets à l'intérieur d'un module. Fil d'ariane dès le 3ᵉ niveau. Retour toujours possible sans le bouton navigateur. Les actions contextuelles vivent dans l'en-tête de la section concernée, jamais dans la sidebar.

## 12. États

Tout écran prévoit : `loading` (squelette reprenant la **structure réelle**, pas un rectangle gris), `empty` (formulé comme une bonne nouvelle ou une invitation, avec l'action de sortie), `error`, `disabled` (`opacity-.45`, pas de changement de teinte), `success`. Un état vide n'affiche jamais « 0 » comme s'il s'agissait d'un échec.

## 13. Responsive

Trois intentions distinctes, pas un empilement.

- **Desktop (≥ 1024 px)** : hiérarchie complète, listes multi-colonnes, métadonnées alignées à droite.
- **Tablette (640–1023 px)** : sidebar repliée, listes conservées, métadonnées secondaires réduites.
- **Mobile (< 640 px)** : une colonne stricte. On **retire ou replie l'information secondaire avant** de réduire les tailles : libellé d'action secondaire remplacé par son icône, métadonnées de ligne réduites, sections de contexte repliées par défaut. Jamais de défilement horizontal de page ; seuls les rails de chips et les tableaux scrollent, dans leur propre conteneur.

## 14. Accessibilité

Contraste AA minimum sur les deux thèmes, `text-muted` inclus. `:focus-visible` global : anneau 2 px `--bt-primary`, offset 2 px. Toute la navigation au clavier, ordre de tabulation = ordre de lecture. Cibles tactiles 44 px sous `pointer: coarse`. **Aucun état communiqué par la couleur seule** : un trait de sévérité est toujours doublé d'un libellé, un chip porte toujours son mot. Les groupes de filtres sont des `role="group"` avec `aria-pressed`, le sélecteur de thème un `role="radiogroup"`.

## 15. Micro-interactions

Couleur / fond / bordure : 120 ms `cubic-bezier(.4,0,.2,1)` ; hover de ligne 90 ms. Transform (chevron, indicateur segmenté) 180 ms `cubic-bezier(.32,.72,0,1)`. Popover 140 ms. Drawer 260 ms. Jauges 240 ms.

**Ne pas animer** : l'apparition des lignes de liste, les chiffres qui défilent, la navigation entre pages, les changements de layout au resize, quoi que ce soit au scroll. `prefers-reduced-motion: reduce` ramène tout à 1 ms — déjà appliqué globalement dans `theme.css`.

## 16. Densité

Objectif : **densité d'information élevée, bruit visuel faible**. On y arrive par l'alignement, le groupement, la typographie et la divulgation progressive — pas en ajoutant du blanc partout.

Règles opérationnelles : deux lignes d'information maximum par ligne de liste (titre + `contexte · détail`), le reste en `title` ou au drill-down ; une liste affiche 5 à 6 éléments puis « Afficher N de plus » ; les sections de contexte sont repliées avec un résumé chiffré suffisant pour décider de les ouvrir ; un seul système de comptage fait autorité par écran. Rien n'est supprimé : tout reste accessible en un clic.

---

## Application au Dashboard (écran pilote)

- **Verdict** — une phrase générée (« 4 urgences sur 2 chantiers, 6 actions en attente. ») plus une barre de charge où **chaque chantier actif compte une seule fois** (critique / à traiter / sous contrôle). Remplace les quatre cartes KPI, qui juxtaposaient des unités différentes sans hiérarchie.
- **À traiter** — file unique fusionnant alertes chantier et demandes matériel, triée par score : `base (nature) + ancienneté + dérive du chantier + concentration`. Les chips filtrent la liste **en place** ; ils ne changent jamais d'écran.
- **Chantiers** — une ligne dense par chantier, les plus exposés d'abord, trait de sévérité à gauche.
- **Activité commerciale** — repliée, résumé limité au total réellement actionnable.

---

## Outil de validation visuelle

`preview.html` (et `preview-mobile.html`, qui l'embarque en 390 px et 820 px) rendent l'écran pilote avec des données fictives, hors authentification, via `src/preview/DashboardPreview.tsx`. Ces entrées ne sont servies que par `vite dev` — `vite build` ne prend que `index.html` — et permettent de juger Light, Dark et mobile sans base de données. Elles demandent seulement `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` présents dans `.env.local` pour que le client Supabase s'initialise ; supprimer ces trois fichiers n'a aucun effet sur l'application.
