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

---

# Annexe A — Anatomie des primitives

Valeurs fermes, applicables telles quelles. `h` = hauteur, `coarse` = sous `@media (pointer: coarse)`.

## Champ texte
h 36 / coarse 44 · px 12 · `rounded-field` · `bg-surface` + `border border-strong` · texte 14/20 `text-ink` · placeholder `text-muted`, **jamais porteur d'information** · `font-size: 16px` sur mobile.
Label : `.bt-caption text-muted`, 6 px au-dessus, jamais en capitales. Requis : `*` en `text-danger` collé au label, pas de mention « (optionnel) ». Aide : `.bt-caption text-muted`, 4 px sous le champ, une ligne. Erreur : **remplace** l'aide (jamais empilée), `.bt-caption text-danger-on` + `border-danger` + `aria-invalid` + `aria-describedby`. Focus : `border-primary` + `box-shadow 0 0 0 3px color-mix(in srgb, var(--bt-primary) 18%, transparent)`, avec `outline: none` pour ne pas doubler l'anneau global. Disabled : `bg-interactive`, `border-subtle`, opacité 0.6, `cursor: not-allowed`. Préfixe/suffixe : icône 16 px `text-muted`, padding porté à 36 px de ce côté.

## Textarea
Mêmes règles · `py 8` · `min-h 88` · `resize-y` · `max-h 320`. Compteur de caractères `.bt-caption text-muted` aligné à droite sous le champ, apparaît à 80 % du quota, `text-warning-on` à 95 %.

## Select
Identique au champ + chevron 16 px `text-muted` à 12 px du bord droit, padding droit 34. Placeholder `text-muted`, valeur choisie `text-ink`. Multi-sélection : chips 24 px dans le champ, hauteur en `min-h`.

## Checkbox / radio
Boîte 18×18 (coarse 20) · `rounded-[5px]` / `rounded-full` · `border-strong` 1.5 px · `bg-surface`. Coché : `bg-primary`, `border-primary`, glyphe `--bt-primary-contrast` 12 px. Indéterminé : barre 10×2. Zone cliquable = boîte + label, `min-h 32 / coarse 44`, gap 10, label 14/20 `text-ink`, aide 13/18 `text-muted` alignée sur le label. Focus : anneau 2 px offset 2 sur la boîte seule.

## Dropdown / menu
`bg-elevated` + `border-subtle` + `shadow-elevated` + `rounded-card` · min-w 200 · max-w 320 · py 4. Item h 32 (coarse 44), px 10, 14/20, icône 16 à gauche, raccourci `.bt-caption text-muted` à droite. Hover `bg-interactive` · sélectionné `bg-selected` + `text-ink` (jamais une coche seule) · séparateur `border-t border-subtle` avec 4 px de marge · en-tête de groupe `.bt-caption text-muted` px 10 py 6 · item destructif `text-danger-on`, toujours en dernier après un séparateur. Ouverture 140 ms, offset 6 px de l'ancre, `flip` puis `shift` avec 8 px de marge de viewport.

## Drawer
Largeurs : ≥1280 → 560 · 1024–1279 → 480 · 640–1023 → 420 · <640 → feuille basse `width: 100vw`, `height: min(88dvh, …)`, `rounded-t-surface`, poignée 36×4 `bg-border-strong` centrée à 8 px du haut.
Desktop : ancré à droite, `rounded-l-surface`, `bg-elevated`, `shadow-overlay`, `border-l border-subtle`. En-tête 56 px collant + `border-b border-subtle`, titre `.bt-section-title`, fermeture 32×32 à droite. Corps `p 20` (mobile 16). Pied 64 px collant + `border-t border-subtle`, actions à droite (mobile : pleine largeur empilées, primaire en haut). Overlay `--bt-overlay`, entrée 260 ms `--bt-ease-spring`, overlay en fondu 180 ms. Focus piégé, `Esc` ferme, focus rendu au déclencheur.

## Modal
Largeurs 400 / 520 / 680 · `max-height 88dvh` · `rounded-dialog` · `bg-elevated` + `shadow-overlay` · padding 24 (mobile 20). En-tête sans bordure quand le corps ne scrolle pas, `border-b` dès qu'il scrolle. Pied à 20 px de marge haute, actions à droite. `.bt-dialog-enter`. **Interdit au-delà de 6 champs** : passer en drawer ou en page.

## Toast
360 large (mobile `calc(100vw - 32px)`) · haut-droite desktop / bas mobile · offset 16 · gap 8 · 3 visibles max, les suivants en file. `bg-elevated` + `border-subtle` + `shadow-elevated` + `rounded-card`, px 14 py 12, icône 16 en ton de statut (jamais un fond entièrement teinté), titre `.bt-card-title`, détail `.bt-secondary text-muted`. Durées : succès 4 s, info 5 s, avec action 8 s, **erreur persistante**. `role="status"`, `role="alert"` si danger.

## Tooltip
px 8 py 5 · `rounded-field` · 12/16 · `bg-ink` avec texte `bg-surface` (inversion volontaire) · max-w 280 · offset 6 · ouverture 400 ms, fermeture 100 ms, 0 ms si un tooltip du même groupe vient de se fermer. Jamais interactif, jamais unique porteur d'une information, **jamais sur mobile** : sous `pointer: coarse` l'information passe en ligne secondaire.

## Fil d'ariane
13/18 `text-muted` · séparateur chevron 14 px `--bt-border-strong` · dernier segment `text-ink` non cliquable · hauteur 20 · marge basse 8 avant le titre. Au-delà de 4 niveaux : premier + points de suspension (menu) + deux derniers. Masqué sous 640 px, remplacé par une flèche retour 32×32 à gauche du titre.

## Onglets de navigation locale
Rail h 40, sans fond ni bordure de conteneur, `border-b border-subtle` sur toute la largeur. Onglet : px 12, 14/20, `text-muted` puis `text-ink` au survol ; actif `text-ink` + filet 2 px `bg-primary` aligné sur la bordure basse (`-mb-px`), transition 180 ms `--bt-ease-spring`. Pastille de compte `.bt-caption bt-num` `bg-interactive text-muted`, active `bg-primary-soft text-primary-on`. `role="tablist"`, flèches gauche/droite. Sous 640 px : scroll horizontal du rail seul, masque en dégradé 24 px à droite.

## Pagination
h 32 (coarse 44) · boutons carrés 32 · gap 4 · `rounded-field`. Page active `bg-selected text-ink` sans bordure ; autres `text-ink-secondary` hover `bg-interactive`. Fenêtre `1 … n−1 n n+1 … N`. À gauche `.bt-caption bt-num text-muted` : « 21–40 sur 312 ». Au-delà de 500 lignes : pagination par curseur, sans numéros. Mobile : Précédent / Suivant pleine largeur et « 3 / 16 » au centre.

## Barre de recherche
h 36 (coarse 44) · loupe 16 à gauche (padding gauche 34) · effacement 16 à droite dès qu'il y a du texte · debounce 250 ms · `Esc` vide · `/` focalise. Largeur 280 par défaut, 100 % sous 768. Le compte de résultats s'affiche **à côté du titre de section**, jamais sous le champ.

## Table
En-tête h 40, `bg-app` en clair et `bg-elevated` en sombre, `.bt-caption text-muted` **jamais en capitales**, `border-b border-subtle`, collant sous l'en-tête de page. Cellule h 44 (coarse 52), px 12, première cellule px 16 alignée sur le padding de la surface, texte 14/20 ; chiffres `.bt-num` alignés à droite, en-tête aligné à droite lui aussi. Lignes `divide-y divide-subtle`, hover `bg-interactive` 90 ms. Tri : en-tête cliquable, chevron 14 px visible sur la colonne triée seulement (opacité 0.4 au survol des autres), `aria-sort`. Sélection : checkbox en colonne 44 px, ligne sélectionnée `bg-selected` + rail gauche 2 px `bg-primary`, barre d'action de lot ancrée en bas (`bg-elevated` + `shadow-elevated`, h 56). Donnée absente : un tiret cadratin en `text-muted`, jamais une cellule vide, jamais « 0 ». Colonne gelée : la première seulement, `position: sticky; left: 0` + ombre droite 8 px au scroll. Sous 768 px la table devient une liste.

---

# Annexe B — Matrice d'états

| État | Champ / select | Menu | Liste / table | Drawer / modal | Bouton |
|---|---|---|---|---|---|
| loading | champ inerte + spinner 14 px à droite, valeur conservée | item unique « Chargement… » `text-muted`, hauteur figée | overlay `bg-surface/60` sur le corps ; en-tête et filtres restent actifs ; **pas** de remplacement du contenu | corps remplacé par squelette, pied désactivé | largeur figée, libellé remplacé par un spinner 14 px, `aria-busy` |
| skeleton | premier rendu seulement | — | 5 lignes reprenant la géométrie réelle : rail 3 px, bloc 60 % × 14, bloc 35 % × 12, `bg-interactive`, pulsation 1.6 s d'opacité 1 vers 0.55, jamais un balayage clair | idem dans le corps | — |
| empty | — | « Aucun résultat » + rappel du terme cherché | icône 24 `text-muted`, titre `.bt-card-title`, phrase `.bt-secondary text-muted`, une action, py 40, **pas** de bordure pointillée | même bloc centré, pied réduit à « Fermer » | — |
| error | `border-danger`, aide remplacée par le message `text-danger-on`, focus au premier champ fautif | item « Impossible de charger » + « Réessayer » | bandeau `bg-danger-soft text-danger-on` en tête de surface + filet 1 px `bg-danger` en bord haut ; **les lignes déjà chargées sont conservées** | bandeau au-dessus du pied, pied actif | variante inchangée, message en toast persistant |
| disabled | `bg-interactive`, `border-subtle`, opacité 0.6, pas de hover | item opacité 0.6, non focusable, tooltip du motif | ligne opacité 0.6, rail de statut conservé à pleine opacité | pied grisé, corps lisible | opacité 0.6, `cursor: not-allowed`, aucun changement de teinte |
| success | `border-success` 1200 ms puis retour, coche 14 px | — | ligne en `bg-success-soft` 600 ms puis fond normal | pied remplacé par un toast, fermeture 200 ms après | libellé « Enregistré » + coche 1400 ms, largeur figée |
| offline | champ éditable, envoi différé, `.bt-caption text-warning-on` « sera envoyé à la reconnexion » | actions serveur retirées, pas grisées | bandeau `bg-warning-soft text-warning-on` h 32 sous l'en-tête + « à jour il y a 6 min » | pied : action primaire devient « Mettre en file » | primaire conservé, secondaires réseau retirés |

---

# Annexe C — Deux patterns du Dashboard

## Sélecteur de vue segmenté
Posé sur la ligne de base du `.bt-section-title`, aligné à droite, **jamais** sur sa propre ligne ni dans une barre d'outils. Piste `bg-interactive`, `rounded-full`, p 2, h 32 (coarse 44). Segment px 12, 13/18, poids 500, `rounded-full`, `min-w 72` ; inactif `text-muted` puis `text-ink-secondary` au survol, sans fond ; actif `bg-surface` + `border border-strong` + `text-ink` poids 550. Le fond actif se déplace en 180 ms `--bt-ease-spring` ; largeur et couleur du texte **ne s'animent pas**. `role="radiogroup"` et `role="radio" aria-checked` : ce n'est pas un `tablist`, le contenu n'est pas remplacé mais réordonné ; flèches gauche/droite circulaires. 2 à 4 segments, libellés d'un mot. Sous 640 px : piste pleine largeur sous le titre, segments `flex-1`, aucun scroll.

## Bande de mesures cliquables
Une seule rangée dans la surface, collée sous l'en-tête de section, `border-b border-subtle`, `bg-surface` — **aucun fond propre, aucune bordure autour d'une mesure, aucun radius, aucune ombre, aucune icône**. `divide-x divide-subtle`, chaque mesure `flex-1`, px 16 py 10, la première alignée sur le padding de la surface. Contenu dans cet ordre : label `.bt-caption text-muted` (12/16), puis valeur `.bt-num` 18/22 poids 650 `text-ink`, marge haute 2. Pas de delta, pas de sparkline, pas de sous-titre.
États : hover `bg-interactive` 90 ms ; focus anneau 2 px offset **−2** (intérieur) ; **actif** = filet 2 px `bg-primary` en bord bas et label en `text-primary-on`, sans fond teinté ni gras supplémentaire. Un second clic sur la mesure active retire le filtre. `role="group"` et `aria-pressed`, libellé accessible « label : valeur ». Une valeur à zéro reste affichée : c'est une bonne nouvelle, pas un vide. **3 mesures par défaut, 4 au maximum.** Sous 640 px : grille 2×2, `divide-x` sur la colonne et `divide-y` entre les rangées, py 12 ; jamais de scroll horizontal.

---

# Annexe D — Grille et largeurs

Conteneur max **1440**, centré. Padding de page : sous 640 → 16 · 640–1023 → 20 · 1024 et plus → 24 · 1536 et plus → 32. Grille 12 colonnes, gouttière 20 (24 à partir de 1280).
Sidebar 264 déployée et 72 repliée (item 44×44), repli automatique sous 1280, hors flux sous 1024. Colonne latérale de contexte **360** fixe à partir de 1280, sinon elle repasse sous la colonne principale. Colonne principale `minmax(0,1fr)` plafonnée à **880** pour une liste ou un formulaire ; une table peut occuper toute la largeur. Paragraphe 72 caractères au maximum.

Ce qui change exactement à chaque rupture :
- **640** — une colonne stricte, drawer en feuille basse, table transformée en liste, fil d'ariane remplacé par une flèche retour, mesures en 2×2, actions secondaires réduites à leur icône.
- **768** — retour des métadonnées de ligne à droite, table autorisée.
- **1024** — sidebar dans le flux, formulaire sur 2 colonnes, drawer 420.
- **1280** — colonne latérale 360, sidebar déployée, drawer 560.
- **1536** — padding 32, gouttière 24 ; **aucune** nouvelle colonne, aucun agrandissement de police.

---

# Annexe E — Contrastes mesurés

Vérifiés sur les valeurs réelles des tokens (WCAG 2.x).

Conformes : en clair `text-muted` sur app **4.92**, sur surface **5.33**, sur interactive **4.78** ; `text-ink-secondary` sur surface **9.99** ; `primary-contrast` sur primary **5.17** et sur hover **6.64** ; danger-on sur soft **5.63** ; info-on sur soft **5.16** ; warning-on sur soft **4.85** ; neutral-on sur soft **7.31** ; primary-on sur soft **6.19**. En sombre : `text-muted` sur app **6.12**, sur surface **5.59**, sur elevated **5.11**, sur interactive **4.68** ; secondary sur surface **9.04** ; contrast sur primary **5.91** ; statuts on sur soft de **7.30** à **9.45**.

Corrigés dans `theme.css` à l'issue de la mesure :

| Paire | Avant | Après |
|---|---|---|
| clair, `success-on` sur `success-soft` | 4.49 | `#12703A` → **5.52** |
| bouton succès, clair | blanc sur `#16A34A` = 3.30 | `--bt-success-strong #15803D` → **5.02** |
| bouton succès, sombre | blanc sur `#34C77B` = 2.19 | `--bt-success-contrast #08111F` → **8.65** |
| `border-strong` clair sur surface | 1.51 | `#8090A8` → **3.24** (WCAG 1.4.11) |
| `border-strong` sombre sur surface | 1.75 | `#5F7392` → **3.57** |
| opacité `disabled` | 0.45 → 2.33 | **0.6** → **3.30** |

`--bt-border-subtle` (1.22 en clair, 1.30 en sombre) reste décoratif : il ne doit **jamais** servir de contour de contrôle. Le fond seul ne différencie pas une surface de l'application (1.08) : la limite est toujours portée par une bordure ou par du vide.

---

# Annexe F — Interdits vérifiables

1. Aucune bordure ni ombre sur un chip ou un badge : fond doux, texte lisible, radius plein, rien d'autre.
2. Aucune ombre sur un bloc statique : `shadow-*` est réservé à `bg-elevated` (menu, popover, drawer, modal, toast, barre flottante).
3. Aucune surface de niveau 1 imbriquée dans une surface de niveau 1.
4. Aucune couleur brute Tailwind (`slate-*`, `blue-*`, `bg-white`, `text-white`) dans un composant.
5. Aucune capitale forcée ni `tracking` supérieur à 0.02em : pas d'eyebrow, pas d'en-tête de table en majuscules.
6. Aucune bordure en pointillés, sauf pendant le survol d'un glisser-déposer.
7. Quatre radius seulement (8 / 12 / 16 / 20) et jamais deux radius supérieurs à 12 px imbriqués.
8. Aucune rangée de cartes KPI, aucune grille de quatre `StatCard`.
9. Aucune animation de contenu : apparition de lignes, chiffres qui défilent, transition de page, réordonnancement, effet au scroll.
10. Aucun statut communiqué par la couleur seule, aucun tooltip unique porteur d'information, aucun placeholder tenant lieu de label, aucun défilement horizontal de la page.
11. Aucun bouton rouge plein hors confirmation destructive finale, et jamais plus d'une action primaire par section.
12. Aucune hauteur minimale inférieure à 44 px sous `@media (pointer: coarse)`, segments, chips, mesures et cellules de pagination compris.
