# Communication : connecter les réseaux et activer la diffusion

Le code est en place. Ce qui reste dépend des plateformes et ne peut pas être fait depuis Batipro.

## 1. L'adresse de retour

Toutes les autorisations reviennent sur une seule adresse, déjà renseignée côté serveur :

```
https://vhwtpwmzaidmlvqcyfep.supabase.co/functions/v1/communication-oauth-callback
```

C'est cette adresse qu'il faut déclarer comme *redirect URI* chez chaque plateforme. Elle doit être copiée au caractère près.

## 2. Les applications à créer

| Plateforme | À créer | Secrets à renseigner |
|---|---|---|
| Meta (Facebook + Instagram) | Une application sur developers.facebook.com, produit « Facebook Login », en mode Business | `META_APP_ID`, `META_APP_SECRET` |
| LinkedIn | Une application sur developer.linkedin.com, rattachée à la page entreprise | `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` |
| Google Business Profile | Un projet Google Cloud, API « Business Profile » activée, écran de consentement publié | `GOOGLE_BUSINESS_CLIENT_ID`, `GOOGLE_BUSINESS_CLIENT_SECRET` |

Les secrets se renseignent dans Supabase, rubrique Edge Functions puis Secrets. Tant qu'un secret manque, l'onglet Connexions le dit nommément et le bouton reste inactif.

Meta et LinkedIn demandent une validation de leurs équipes avant que l'application sorte du mode test. Compter plusieurs jours. En mode test, seuls les comptes déclarés développeurs peuvent autoriser l'accès, ce qui suffit pour vérifier le parcours.

Permissions demandées par Batipro :

- Facebook : `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `pages_manage_engagement`, `business_management`
- Instagram : les mêmes, plus `instagram_basic`, `instagram_content_publish`, `instagram_manage_comments`, `instagram_manage_insights`
- LinkedIn : `r_organization_social`, `w_organization_social`, `rw_organization_admin`
- Google : `https://www.googleapis.com/auth/business.manage`

## 3. Activer les tâches de fond

Trois fonctions serveur tournent en arrière-plan. Aucune n'est encore programmée.

Dans Supabase, rubrique Integrations puis Cron, créer un travail pour chacune. Type Edge Function, avec l'en-tête HTTP `x-communication-cron` portant la valeur du secret `COMMUNICATION_CRON_SECRET`, lisible dans Edge Functions puis Secrets. Sans cet en-tête la fonction répond « Appel non autorisé », pour que personne d'autre ne la déclenche.

| Fonction | Fréquence conseillée | Rôle |
|---|---|---|
| `communication-publish` | toutes les 5 minutes | Diffuse les publications validées dont l'heure est venue |
| `communication-inbox-sync` | toutes les 15 minutes | Récupère messages, commentaires et avis |
| `communication-metrics-sync` | toutes les 6 heures | Relève les chiffres des publications diffusées |

## 4. Ce que couvre chaque réseau

| | Publier | Boîte de réception | Statistiques |
|---|---|---|---|
| Facebook | Oui | Messages et commentaires | Portée, impressions, engagements, clics |
| Instagram | Oui, média obligatoire | Messages et commentaires | Portée et engagements |
| LinkedIn | Oui, texte et lien | Non | Réactions et commentaires |
| Google Business | Oui | Avis, avec réponse | Non fourni par Google par publication |

## 5. Ce qui n'est pas encore branché

- TikTok et YouTube ne sont pas pris en charge.
- Les commentaires LinkedIn ne remontent pas dans la boîte de réception : le réseau ne les expose que publication par publication.
- Les appels aux API des réseaux n'ont jamais été exécutés contre un vrai compte, faute d'identifiants. Le premier essai réel demandera sans doute des ajustements.
