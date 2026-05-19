# QA Sprint C - Documents premium et workflow client

## 1. Templates document-engine

Types couverts :

- Devis
- Facture
- Avoir
- Bon de commande
- PV de réception

Contrôles :

- Chaque type utilise un libellé métier adapté.
- Le PDF affiche l'entreprise, le destinataire, le chantier/adresse, les lignes et les totaux.
- Les signatures sont affichées pour devis, bons de commande et PV réception.

## 2. PDF premium

À vérifier :

- Header premium sombre.
- Cartes entreprise/client.
- Sections et sous-sections lisibles.
- Lignes denses avec quantité, unité, PU HT, TVA, total HT.
- Totaux HT/TVA/TTC et net à payer.
- Ventilation TVA.
- Conditions, mentions, gestion déchets et notes.
- Pagination sur document long.
- Footer avec pagination.

## 3. Preview client

À vérifier :

- Viewer premium.
- Actions téléchargement et envoi visibles.
- Rendu non éditable.
- Hiérarchie cohérente avec le PDF.

## 4. Workflow envoi client

À vérifier :

- Destinataire modifiable.
- Objet modifiable.
- Message modifiable.
- Options PDF, validation, signature, demande modification, relances.
- Lien client généré.
- Fallback email local via `mailto:` si aucun backend email n'est branché.

Limite assumée :

- L'envoi SMTP réel et le stockage tokenisé doivent être branchés côté backend avant production.

## 5. Signature électronique

Préparation V1 :

- Option signature présente dans le workflow.
- Zone signature présente dans les PDF concernés.
- Le client peut être orienté vers le futur portail sécurisé.

À faire ensuite :

- Table de liens clients tokenisés.
- Page publique de consultation.
- Acceptation/refus/demande modification persistés.
- Preuve technique minimale.
- Provider email/signature.

## 6. Build

- `npm run build` doit passer.

