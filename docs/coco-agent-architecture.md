# Architecture cible - Agent Coco Batipro

## Objectif

Coco ne doit plus etre un bouton IA qui reformule des champs. Coco doit devenir un systeme metier de preparation chantier capable de transformer les donnees Batipro en actions exploitables pour le devis, le chantier, le DOE et les retours terrain.

Flux cible :

```text
Produit catalogue
  -> documents fournisseur / FT / notice / domaine d'application
  -> analyse structuree produit
  -> template de tache
  -> generation Coco
  -> chantier / intervenant
  -> retour terrain
  -> amelioration bibliotheque
```

## Principe central

Chaque agent Coco travaille par objectif metier.

Mauvaise logique :

```text
Je lis un document et j'essaie d'en faire quelque chose.
```

Bonne logique :

```text
Je dois creer une tache executable, donc je cherche explicitement les ratios, outils, supports, limites, etapes, controles, couts et risques.
```

## Sous-agents Coco

### 1. Coco Lecteur produit

Declenchement : import produit, fiche technique, notice, devis fournisseur, document fournisseur.

Mission : transformer les documents produit en donnees structurees.

Sorties attendues :

```json
{
  "productIdentity": {
    "designation": "",
    "brand": "",
    "manufacturerReference": "",
    "supplier": ""
  },
  "prices": {
    "purchaseUnitPriceHt": 0,
    "recommendedSaleUnitPriceHt": 0,
    "unit": "l"
  },
  "materialUsage": {
    "ratioQuantity": 0.34,
    "ratioUnit": "l",
    "sourceUnit": "m2",
    "lossPercent": 15,
    "confidence": 0.9,
    "reasoning": "Consommation extraite de la fiche technique"
  },
  "application": {
    "supports": [],
    "applicationScope": [],
    "tools": [],
    "conditions": [],
    "limits": []
  },
  "procedure": [],
  "doeDocuments": [],
  "warnings": []
}
```

Regles :
- CB RENOVATION ne doit jamais etre fournisseur.
- Le fournisseur vient du vendeur/emetteur du devis, pas du client livre.
- Le prix achat doit venir du PU net / prix net / prix achat exploitable.
- Les textes legaux, adresses, fax, sites web, COV/FDES/certifications inutiles ne doivent pas polluer les modes operatoires.

### 2. Coco Preparateur template

Declenchement : bouton `Generer avec Coco` dans le drawer template.

Entrees :
- designation
- lot
- unite de production
- usage metier
- produits lies avec analyses structurees
- main d'oeuvre
- materiel/frais existants
- retours terrain historiques du lot ou de produits similaires

Mission : creer une tache complete pour 1 unite de production.

Sorties :

```json
{
  "materials": [
    {
      "productId": "",
      "name": "",
      "quantity": 0.34,
      "unit": "l",
      "forUnit": "m2",
      "lossPercent": 15,
      "reasoning": "Ratio issu de la fiche technique produit",
      "uncertain": false
    }
  ],
  "equipment": [
    {
      "name": "Rouleau polyamide texture 18 mm",
      "quantity": 1,
      "unit": "u",
      "reasoning": "Outil d'application indique dans la fiche technique",
      "uncertain": false
    }
  ],
  "procedure": [],
  "controls": [],
  "errorsToAvoid": [],
  "technicalDescription": "",
  "characteristics": [],
  "fieldReturns": [],
  "costSummary": {},
  "missingInformation": [],
  "confidence": "high"
}
```

### 3. Coco Chiffrage

Mission : calculer les couts et prix de vente a partir de donnees structurees.

Calculs :
- cout materiau par unite = prix achat unite produit x ratio x pertes
- prix vente materiau = prix vente unite produit x ratio x pertes
- cout MO = temps/unite x cout horaire
- prix vente MO = cout horaire x marge lot
- cout frais = frais fixes ou location / unite
- prix de revient ouvrage = materiaux + MO + frais
- prix vente conseille = prix vente materiaux + prix vente MO + prix vente frais
- marge HT = PV - PR
- taux marge = marge / PV

Les calculs doivent etre centralises et reutilisables, pas disperses dans le drawer.

### 4. Coco Terrain

Mission : produire une version courte et actionnable pour l'intervenant.

Sorties :
- ce qu'il faut faire aujourd'hui
- materiaux a prendre
- outillage a prendre
- points de controle
- erreurs a eviter
- documents accessibles : FT, notice, domaine d'application, FDS si utile

Cette vue doit etre disponible dans la tache chantier consultee par l'intervenant.

### 5. Coco Retour terrain

Declenchement : retour terrain intervenant / chef de chantier.

Mission : transformer les retours en ameliorations.

Exemples :
- ratio theorique = 0.34 l/m2, reel = 0.42 l/m2
- temps prevu = 0.4 h/m2, reel = 0.55 h/m2
- materiel oublie : rallonge, buse, escabeau
- probleme support recurrent

Sorties :
- proposition d'ajustement template
- proposition d'ajustement produit
- alerte si ecart recurrent
- historique conservable pour prochaines generations

## Donnees a persister

### Produits

Ajouter/maintenir des champs structures :
- materialUsage
- applicationTools
- compatibleSupports
- forbiddenSupports
- weatherLimits
- workMethodSteps
- doeUsage
- extractionConfidence
- extractionReasoning

### Lots metier

Les lots ne doivent pas rester uniquement dans localStorage.

Table cible : `task_template_lot_profiles`

Champs :
- id
- label
- keywords
- default_unit
- labor_margin_rate
- quote_visible_default
- chantier_visible_default
- field_guidance
- default_tools
- default_controls
- default_errors_to_avoid
- created_at
- updated_at

### Templates

Le template doit stocker :
- materials_generated
- equipment_generated
- procedure_generated
- controls_generated
- errors_generated
- cost_summary
- coco_generation_payload
- coco_generation_result
- confidence
- missing_information

## Edge Functions cible

### generate-task-template

Role : vraie generation IA du template.

Entree : payload complet du drawer + produits enrichis + retours terrain.

Sortie : JSON strict exploitable par l'UI.

### analyze-product-documents

Role : analyse produit structuree.

Entree : document texte/PDF extrait + contexte produit.

Sortie : donnees structurees produit.

### summarize-field-feedback

Role : apprendre des retours terrain.

Entree : retours chantier + template + produits.

Sortie : suggestions d'amelioration.

## Interface cible drawer template

Ordre obligatoire :

1. Designation
2. Lot en menu deroulant depuis les lots configures
3. Unite
4. Usage metier
5. Materiaux lies aux produits catalogue
6. Main d'oeuvre
7. Materiel / frais
8. Calcul automatique ouvrage
9. Coco - generation IA
10. Sorties visibles :
   - liste materiaux
   - liste materiel
   - mode operatoire
   - controles
   - erreurs a eviter
   - informations manquantes
11. Champs enregistres :
   - description technique
   - caracteristiques
   - remarques / retours terrain

## Comportement attendu pour PANTIFILM

Si le produit PANTIFILM OS MAT est lie a une tache facade en m2 :

Coco doit comprendre :
- ratio : 0.340 l/m2 si present dans la fiche produit
- materiaux : PANTIFILM OS MAT, primaire si la fiche ou la designation l'indique
- materiel : protections, baches, adhesif, brosse, rouleau polyamide texture 18 mm, pistolet 200 bars avec buse 519 si application mecanisee, nettoyeur HP si preparation facade
- mode operatoire : verifier support, proteger, nettoyer, egrener/brosser, secher, appliquer primaire si necessaire, appliquer finition, respecter sechage, controler aspect
- erreurs : pluie, gel, humidite, support non sec, interieur si interdit, teinte foncee au soleil si limite fabricant, oubli protection

## Roadmap d'implementation

### Sprint 1 - stabilisation Coco template

- Brancher definitivement `TaskTemplateDrawer` sur `generate-task-template`.
- Supprimer le plus possible les heuristiques JS du bridge.
- Garder un fallback local minimal uniquement en cas d'echec IA.
- Afficher resultats IA visibles et remplir champs enregistres.

### Sprint 2 - analyse produit structuree

- Creer une Edge Function d'analyse produit.
- A l'import FT/notice/devis fournisseur, stocker les donnees structurees dans `ProductDocument.analysis` et/ou au niveau produit.
- Ne plus stocker les informations importantes uniquement dans `notes`.

### Sprint 3 - lots persistants

- Creer table Supabase des lots metier.
- Remplacer localStorage.
- Relier lots -> templates -> calcul MO.

### Sprint 4 - retours terrain apprenants

- Stocker retours terrain par tache/template/produit.
- Generer suggestions d'amelioration.
- Ajouter validation humaine avant mise a jour bibliotheque.

## Regles de qualite

- Toute generation Coco doit afficher son niveau de confiance.
- Toute donnee incertaine doit etre marquee comme incertaine.
- Coco ne doit jamais ecraser silencieusement une saisie humaine importante.
- L'intervenant doit lire des consignes simples, pas des fiches fabricant brutes.
- Les documents produit utiles doivent suivre le produit jusque dans la tache chantier et le DOE.
