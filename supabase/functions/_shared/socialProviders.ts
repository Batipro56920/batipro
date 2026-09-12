/**
 * Adaptateurs des reseaux sociaux.
 *
 * Chaque reseau demande la meme chose dans un ordre different : une URL
 * d'autorisation, un echange de code contre un jeton, puis la decouverte des
 * pages ou comptes que l'utilisateur administre. Le reste du module
 * Communication ne connait que ces trois operations.
 *
 * Aucun identifiant n'est ecrit en dur : tant que les secrets d'un reseau ne
 * sont pas renseignes cote serveur, ce reseau se declare non configure et le
 * bouton correspondant reste inactif, avec la raison affichee.
 */

export type ProviderId = "facebook" | "instagram" | "linkedin" | "google_business" | "tiktok" | "youtube";

export type DiscoveredAccount = {
  externalAccountId: string;
  displayName: string;
  avatarUrl: string | null;
  parentAccountId: string | null;
  /** Jeton propre au compte quand le reseau en fournit un (page Facebook). */
  accessToken: string | null;
};

export type TokenSet = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string | null;
  scopes: string[];
};

const META_VERSION = "v21.0";

function env(name: string): string | null {
  const value = Deno.env.get(name);
  return value && value.trim() ? value.trim() : null;
}

function requireEnv(name: string): string {
  const value = env(name);
  if (!value) throw new Error(`Secret ${name} manquant sur le serveur.`);
  return value;
}

function expiryFromSeconds(seconds: unknown): string | null {
  const value = Number(seconds);
  if (!Number.isFinite(value) || value <= 0) return null;
  return new Date(Date.now() + value * 1000).toISOString();
}

async function readJson(response: Response, context: string) {
  const text = await response.text();
  let payload: any = null;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = null; }
  if (!response.ok) {
    const message = payload?.error?.message ?? payload?.error_description ?? payload?.message ?? payload?.error ?? text.slice(0, 300);
    throw new Error(`${context} : ${message || response.status}`);
  }
  return payload ?? {};
}

type ProviderAdapter = {
  label: string;
  /** Secrets exiges pour que le reseau soit utilisable. */
  secrets: string[];
  scopes: string[];
  authorizeUrl(input: { state: string; redirectUri: string }): string;
  exchange(input: { code: string; redirectUri: string }): Promise<TokenSet>;
  discoverAccounts(tokens: TokenSet): Promise<DiscoveredAccount[]>;
};

const META_PAGE_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  // Lire les commentaires laisses par les visiteurs releve d'une autorisation
  // distincte de la lecture des publications de la Page elle-meme.
  "pages_read_user_content",
  "pages_manage_posts",
  "pages_manage_engagement",
  "business_management",
];
const META_INSTAGRAM_SCOPES = [
  ...META_PAGE_SCOPES,
  "instagram_basic",
  "instagram_content_publish",
  "instagram_manage_comments",
  "instagram_manage_insights",
];

function metaAuthorizeUrl(scopes: string[]) {
  return (input: { state: string; redirectUri: string }) => {
    const params = new URLSearchParams({
      client_id: requireEnv("META_APP_ID"),
      redirect_uri: input.redirectUri,
      state: input.state,
      response_type: "code",
      scope: scopes.join(","),
    });
    return `https://www.facebook.com/${META_VERSION}/dialog/oauth?${params.toString()}`;
  };
}

async function metaExchange(input: { code: string; redirectUri: string }): Promise<TokenSet> {
  const shortParams = new URLSearchParams({
    client_id: requireEnv("META_APP_ID"),
    client_secret: requireEnv("META_APP_SECRET"),
    redirect_uri: input.redirectUri,
    code: input.code,
  });
  const short = await readJson(
    await fetch(`https://graph.facebook.com/${META_VERSION}/oauth/access_token?${shortParams.toString()}`),
    "Échange du code Meta",
  );

  // Le jeton court expire en une heure : sans l'échange long, la connexion
  // serait morte avant la première publication programmée.
  const longParams = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: requireEnv("META_APP_ID"),
    client_secret: requireEnv("META_APP_SECRET"),
    fb_exchange_token: String(short.access_token ?? ""),
  });
  const long = await readJson(
    await fetch(`https://graph.facebook.com/${META_VERSION}/oauth/access_token?${longParams.toString()}`),
    "Prolongation du jeton Meta",
  );

  return {
    accessToken: String(long.access_token ?? short.access_token ?? ""),
    refreshToken: null,
    expiresAt: expiryFromSeconds(long.expires_in ?? short.expires_in),
    scopes: [],
  };
}

async function metaPages(tokens: TokenSet) {
  const params = new URLSearchParams({
    access_token: tokens.accessToken,
    fields: "id,name,access_token,picture{url},instagram_business_account{id,username,profile_picture_url}",
    limit: "100",
  });
  const payload = await readJson(
    await fetch(`https://graph.facebook.com/${META_VERSION}/me/accounts?${params.toString()}`),
    "Lecture des pages Meta",
  );
  return Array.isArray(payload.data) ? payload.data : [];
}

const PROVIDERS: Record<ProviderId, ProviderAdapter> = {
  facebook: {
    label: "Facebook Pages",
    secrets: ["META_APP_ID", "META_APP_SECRET"],
    scopes: META_PAGE_SCOPES,
    authorizeUrl: metaAuthorizeUrl(META_PAGE_SCOPES),
    exchange: metaExchange,
    async discoverAccounts(tokens) {
      const pages = await metaPages(tokens);
      return pages.map((page: any) => ({
        externalAccountId: String(page.id),
        displayName: String(page.name ?? "Page Facebook"),
        avatarUrl: page?.picture?.data?.url ?? null,
        parentAccountId: null,
        accessToken: page.access_token ? String(page.access_token) : null,
      }));
    },
  },
  instagram: {
    label: "Instagram professionnel",
    secrets: ["META_APP_ID", "META_APP_SECRET"],
    scopes: META_INSTAGRAM_SCOPES,
    authorizeUrl: metaAuthorizeUrl(META_INSTAGRAM_SCOPES),
    exchange: metaExchange,
    async discoverAccounts(tokens) {
      const pages = await metaPages(tokens);
      // Un compte Instagram professionnel se publie toujours à travers la page
      // Facebook à laquelle il est rattaché, avec le jeton de cette page.
      return pages
        .filter((page: any) => page?.instagram_business_account?.id)
        .map((page: any) => ({
          externalAccountId: String(page.instagram_business_account.id),
          displayName: String(page.instagram_business_account.username ?? page.name ?? "Compte Instagram"),
          avatarUrl: page.instagram_business_account.profile_picture_url ?? null,
          parentAccountId: String(page.id),
          accessToken: page.access_token ? String(page.access_token) : null,
        }));
    },
  },
  linkedin: {
    label: "LinkedIn Page",
    secrets: ["LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET"],
    scopes: ["r_organization_social", "w_organization_social", "rw_organization_admin"],
    authorizeUrl(input) {
      const params = new URLSearchParams({
        response_type: "code",
        client_id: requireEnv("LINKEDIN_CLIENT_ID"),
        redirect_uri: input.redirectUri,
        state: input.state,
        scope: PROVIDERS.linkedin.scopes.join(" "),
      });
      return `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
    },
    async exchange(input) {
      const payload = await readJson(
        await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "authorization_code",
            code: input.code,
            redirect_uri: input.redirectUri,
            client_id: requireEnv("LINKEDIN_CLIENT_ID"),
            client_secret: requireEnv("LINKEDIN_CLIENT_SECRET"),
          }),
        }),
        "Échange du code LinkedIn",
      );
      return {
        accessToken: String(payload.access_token ?? ""),
        refreshToken: payload.refresh_token ? String(payload.refresh_token) : null,
        expiresAt: expiryFromSeconds(payload.expires_in),
        scopes: String(payload.scope ?? "").split(/[ ,]+/).filter(Boolean),
      };
    },
    async discoverAccounts(tokens) {
      const payload = await readJson(
        await fetch(
          "https://api.linkedin.com/rest/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED&projection=(elements*(organization~(id,localizedName,logoV2)))",
          { headers: { Authorization: `Bearer ${tokens.accessToken}`, "LinkedIn-Version": "202409", "X-Restli-Protocol-Version": "2.0.0" } },
        ),
        "Lecture des pages LinkedIn",
      );
      const elements = Array.isArray(payload.elements) ? payload.elements : [];
      return elements.map((element: any) => {
        const organization = element["organization~"] ?? {};
        const urn = String(element.organization ?? `urn:li:organization:${organization.id ?? ""}`);
        return {
          externalAccountId: urn,
          displayName: String(organization.localizedName ?? "Page LinkedIn"),
          avatarUrl: null,
          parentAccountId: null,
          accessToken: null,
        };
      });
    },
  },
  tiktok: {
    label: "TikTok",
    secrets: ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET"],
    scopes: ["user.info.basic", "video.publish", "video.upload", "video.list"],
    authorizeUrl(input) {
      const params = new URLSearchParams({
        client_key: requireEnv("TIKTOK_CLIENT_KEY"),
        scope: PROVIDERS.tiktok.scopes.join(","),
        response_type: "code",
        redirect_uri: input.redirectUri,
        state: input.state,
      });
      return `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`;
    },
    async exchange(input) {
      const payload = await readJson(
        await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_key: requireEnv("TIKTOK_CLIENT_KEY"),
            client_secret: requireEnv("TIKTOK_CLIENT_SECRET"),
            code: input.code,
            grant_type: "authorization_code",
            redirect_uri: input.redirectUri,
          }),
        }),
        "Échange du code TikTok",
      );
      return {
        accessToken: String(payload.access_token ?? ""),
        refreshToken: payload.refresh_token ? String(payload.refresh_token) : null,
        expiresAt: expiryFromSeconds(payload.expires_in),
        scopes: String(payload.scope ?? "").split(/[ ,]+/).filter(Boolean),
        // L'identifiant du compte arrive avec le jeton : inutile de le redemander.
        openId: payload.open_id ? String(payload.open_id) : null,
      } as TokenSet & { openId: string | null };
    },
    async discoverAccounts(tokens) {
      const payload = await readJson(
        await fetch("https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url", {
          headers: { Authorization: `Bearer ${tokens.accessToken}` },
        }),
        "Lecture du compte TikTok",
      );
      const user = payload?.data?.user ?? {};
      const openId = String(user.open_id ?? (tokens as { openId?: string }).openId ?? "");
      if (!openId) return [];
      return [{
        externalAccountId: openId,
        displayName: String(user.display_name ?? "Compte TikTok"),
        avatarUrl: user.avatar_url ? String(user.avatar_url) : null,
        parentAccountId: null,
        accessToken: null,
      }];
    },
  },
  youtube: {
    label: "YouTube",
    secrets: ["YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET"],
    scopes: [
      "https://www.googleapis.com/auth/youtube.upload",
      "https://www.googleapis.com/auth/youtube.force-ssl",
    ],
    authorizeUrl(input) {
      const params = new URLSearchParams({
        client_id: requireEnv("YOUTUBE_CLIENT_ID"),
        redirect_uri: input.redirectUri,
        response_type: "code",
        access_type: "offline",
        prompt: "consent",
        include_granted_scopes: "true",
        scope: PROVIDERS.youtube.scopes.join(" "),
        state: input.state,
      });
      return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    },
    async exchange(input) {
      const payload = await readJson(
        await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: requireEnv("YOUTUBE_CLIENT_ID"),
            client_secret: requireEnv("YOUTUBE_CLIENT_SECRET"),
            redirect_uri: input.redirectUri,
            grant_type: "authorization_code",
            code: input.code,
          }),
        }),
        "Échange du code YouTube",
      );
      if (!payload.refresh_token) {
        throw new Error("Google n'a pas renvoyé de refresh token. Révoque l'accès dans ton compte Google puis reconnecte.");
      }
      return {
        accessToken: String(payload.access_token ?? ""),
        refreshToken: String(payload.refresh_token),
        expiresAt: expiryFromSeconds(payload.expires_in),
        scopes: String(payload.scope ?? "").split(/s+/).filter(Boolean),
      };
    },
    async discoverAccounts(tokens) {
      const payload = await readJson(
        await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", {
          headers: { Authorization: `Bearer ${tokens.accessToken}` },
        }),
        "Lecture de la chaîne YouTube",
      );
      const items = Array.isArray(payload.items) ? payload.items : [];
      return items.map((channel: any) => ({
        externalAccountId: String(channel.id ?? ""),
        displayName: String(channel?.snippet?.title ?? "Chaîne YouTube"),
        avatarUrl: channel?.snippet?.thumbnails?.default?.url ?? null,
        parentAccountId: null,
        accessToken: null,
      })).filter((account: { externalAccountId: string }) => account.externalAccountId);
    },
  },
  google_business: {
    label: "Google Business Profile",
    secrets: ["GOOGLE_BUSINESS_CLIENT_ID", "GOOGLE_BUSINESS_CLIENT_SECRET"],
    scopes: ["https://www.googleapis.com/auth/business.manage"],
    authorizeUrl(input) {
      const params = new URLSearchParams({
        client_id: requireEnv("GOOGLE_BUSINESS_CLIENT_ID"),
        redirect_uri: input.redirectUri,
        response_type: "code",
        access_type: "offline",
        prompt: "consent",
        include_granted_scopes: "true",
        scope: PROVIDERS.google_business.scopes.join(" "),
        state: input.state,
      });
      return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    },
    async exchange(input) {
      const payload = await readJson(
        await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: requireEnv("GOOGLE_BUSINESS_CLIENT_ID"),
            client_secret: requireEnv("GOOGLE_BUSINESS_CLIENT_SECRET"),
            redirect_uri: input.redirectUri,
            grant_type: "authorization_code",
            code: input.code,
          }),
        }),
        "Échange du code Google",
      );
      if (!payload.refresh_token) {
        throw new Error("Google n'a pas renvoyé de refresh token. Révoque l'accès dans ton compte Google puis reconnecte.");
      }
      return {
        accessToken: String(payload.access_token ?? ""),
        refreshToken: String(payload.refresh_token),
        expiresAt: expiryFromSeconds(payload.expires_in),
        scopes: String(payload.scope ?? "").split(/\s+/).filter(Boolean),
      };
    },
    async discoverAccounts(tokens) {
      const accounts = await readJson(
        await fetch("https://mybusinessaccountmanagement.googleapis.com/v1/accounts", {
          headers: { Authorization: `Bearer ${tokens.accessToken}` },
        }),
        "Lecture des comptes Google Business",
      );
      const list = Array.isArray(accounts.accounts) ? accounts.accounts : [];
      const discovered: DiscoveredAccount[] = [];
      for (const account of list) {
        const name = String(account.name ?? "");
        if (!name) continue;
        const locations = await readJson(
          await fetch(
            `https://mybusinessbusinessinformation.googleapis.com/v1/${name}/locations?readMask=name,title&pageSize=100`,
            { headers: { Authorization: `Bearer ${tokens.accessToken}` } },
          ),
          "Lecture des établissements Google Business",
        );
        for (const location of Array.isArray(locations.locations) ? locations.locations : []) {
          discovered.push({
            externalAccountId: String(location.name ?? ""),
            displayName: String(location.title ?? account.accountName ?? "Établissement"),
            avatarUrl: null,
            parentAccountId: name,
            accessToken: null,
          });
        }
      }
      return discovered;
    },
  },
};

export function providerAdapter(provider: string): ProviderAdapter {
  const adapter = PROVIDERS[provider as ProviderId];
  if (!adapter) throw new Error(`Réseau ${provider} non pris en charge.`);
  return adapter;
}

/** Un réseau est utilisable quand tous ses secrets serveur sont renseignés. */
export function providerReadiness() {
  const redirectUri = env("COMMUNICATION_OAUTH_REDIRECT_URI");
  return (Object.keys(PROVIDERS) as ProviderId[]).map((id) => {
    const adapter = PROVIDERS[id];
    const missing = adapter.secrets.filter((secret) => !env(secret));
    if (!redirectUri) missing.push("COMMUNICATION_OAUTH_REDIRECT_URI");
    // Les permissions demandees au reseau : le bureau doit les declarer a
    // l'identique dans la console du reseau, sinon l'autorisation echoue.
    return { provider: id, label: adapter.label, configured: missing.length === 0, missingSecrets: missing, scopes: adapter.scopes };
  });
}

export function redirectUri() {
  return requireEnv("COMMUNICATION_OAUTH_REDIRECT_URI");
}
