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

## 3. Activer la diffusion automatique

Une publication validée et planifiée crée un travail de diffusion. Un service doit venir vider cette file. Il n'est pas encore programmé.

Dans Supabase, rubrique Integrations puis Cron, créer un travail :

- Nom : `communication-publish`
- Fréquence : toutes les 5 minutes
- Type : Edge Function, fonction `communication-publish`
- En-tête HTTP : `x-communication-cron` avec la valeur du secret `COMMUNICATION_CRON_SECRET`, lisible dans Edge Functions puis Secrets

Sans cet en-tête la fonction répond « Appel non autorisé », pour que personne d'autre ne déclenche de diffusion.

## 4. Ce qui n'est pas encore branché

- La boîte de réception n'affiche que ce qui est en base et rien ne l'alimente : la synchronisation des messages, commentaires et avis reste à écrire.
- Les statistiques additionnent une table que rien ne remplit.
- TikTok et YouTube ne sont pas pris en charge.
- Les appels aux API des réseaux n'ont jamais été exécutés contre un vrai compte, faute d'identifiants. Le premier essai réel demandera sans doute des ajustements.
