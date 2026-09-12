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
| LinkedIn | Une application sur developer.linkedin.com, avec le produit « Share on LinkedIn » | `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` |
| Google Business Profile | Un projet Google Cloud, API « Business Profile » activée, écran de consentement publié | `GOOGLE_BUSINESS_CLIENT_ID`, `GOOGLE_BUSINESS_CLIENT_SECRET` |
| TikTok | Une application sur developers.tiktok.com, produits « Login Kit » et « Content Posting API » | `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET` |
| YouTube | Un projet Google Cloud, API « YouTube Data API v3 » activée, écran de consentement publié | `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET` |

Google Business et YouTube sont deux applications distinctes, même dans un seul projet Google Cloud. Leurs identifiants ne sont pas interchangeables.

Les secrets se renseignent dans Supabase, rubrique Edge Functions puis Secrets. Tant qu'un secret manque, l'onglet Connexions le dit nommément et le bouton reste inactif.

Meta et LinkedIn demandent une validation de leurs équipes avant que l'application sorte du mode test. Compter plusieurs jours. En mode test, seuls les comptes déclarés développeurs peuvent autoriser l'accès, ce qui suffit pour vérifier le parcours.

Permissions demandées par Batipro :

- Facebook : `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `pages_manage_engagement`, `business_management`
- Instagram : les mêmes, plus `instagram_basic`, `instagram_content_publish`, `instagram_manage_comments`, `instagram_manage_insights`
- LinkedIn : `openid`, `profile`, `w_member_social`
- Google : `https://www.googleapis.com/auth/business.manage`
- TikTok : `user.info.basic`, `video.publish`, `video.upload`, `video.list`
- YouTube : `youtube.upload`, `youtube.force-ssl`

Tant que TikTok n'a pas audité l'application, ses règles n'autorisent que des publications privées. Renseigner alors le secret `TIKTOK_PRIVACY_LEVEL` avec la valeur `SELF_ONLY` : sans lui, TikTok refuse l'envoi et le message d'erreur le dit. Une fois l'audit obtenu, supprimer ce secret pour revenir aux publications publiques.

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
| LinkedIn | Oui, sur le compte connecté | Non | Non |
| Google Business | Oui | Avis, avec réponse | Non fourni par Google par publication |
| TikTok | Oui, vidéo de 64 Mo maximum | Non, TikTok réserve les commentaires à ses partenaires | Vues, mentions j'aime, commentaires, partages |
| YouTube | Oui, vidéo de 128 Mo maximum | Commentaires des vidéos publiées depuis Batipro | Vues, mentions j'aime, commentaires |

Sur YouTube, le titre interne de la publication devient le titre de la vidéo, limité à 100 caractères, et le texte validé devient la description. Les vidéos partent publiques ; pour les mettre en privé le temps des essais, renseigner le secret `YOUTUBE_PRIVACY_STATUS` avec la valeur `private`.

## 5. Limites imposées par les réseaux

- LinkedIn publie au nom du compte connecté, pas d'une page entreprise. Publier au nom d'une organisation exigerait une page entreprise vérifiée et le produit « Community Management API », soumis à validation. En contrepartie, ni les commentaires ni les statistiques ne sont accessibles : LinkedIn les réserve aux publications d'organisation.
- YouTube ne donne pas les impressions dans l'API utilisée ici : ce sont les vues qui font foi. Les impressions existent dans l'API Analytics, qui demande une autorisation supplémentaire.
- Les vidéos transitent par la fonction serveur, qui les télécharge puis les renvoie au réseau. Au-delà d'une centaine de mégaoctets, il faudra passer par un envoi en plusieurs morceaux.
- Les appels aux API des réseaux n'ont jamais été exécutés contre un vrai compte, faute d'identifiants. Le premier essai réel demandera sans doute des ajustements.
