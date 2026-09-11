/**
 * Diffusion d'une publication sur un reseau.
 *
 * Un seul point d'entree : publishToNetwork. Chaque reseau a sa mecanique,
 * mais l'appelant ne voit qu'un identifiant de publication et une adresse.
 * Les erreurs remontent le message du reseau, jamais un code seul : c'est ce
 * message qui dira au bureau ce qu'il faut corriger.
 */

export type PublishInput = {
  provider: string;
  /** Titre interne de la publication, seul YouTube en exige un distinct du texte. */
  title: string;
  externalAccountId: string;
  parentAccountId: string | null;
  accessToken: string;
  body: string;
  linkUrl: string | null;
  mediaUrls: string[];
  videoUrls: string[];
};

export type PublishResult = { postId: string; url: string | null };

const META_VERSION = "v21.0";

function env(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Secret ${name} manquant sur le serveur.`);
  return value;
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

/** TikTok expire en vingt-quatre heures : le renouvellement rend le jeton précédent caduc. */
export async function refreshTiktokToken(refreshToken: string) {
  const payload = await readJson(
    await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: env("TIKTOK_CLIENT_KEY"),
        client_secret: env("TIKTOK_CLIENT_SECRET"),
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    }),
    "Renouvellement du jeton TikTok",
  );
  return {
    accessToken: String(payload.access_token ?? ""),
    refreshToken: payload.refresh_token ? String(payload.refresh_token) : refreshToken,
    expiresAt: new Date(Date.now() + Number(payload.expires_in ?? 86400) * 1000).toISOString(),
  };
}

/**
 * Le jeton Google expire en une heure : il se renouvelle avant chaque envoi.
 *
 * Google Business et YouTube sont deux applications distinctes chez Google :
 * renouveler l'une avec les identifiants de l'autre echoue.
 */
export async function refreshGoogleToken(refreshToken: string, provider: string) {
  const prefix = provider === "youtube" ? "YOUTUBE" : "GOOGLE_BUSINESS";
  const payload = await readJson(
    await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env(`${prefix}_CLIENT_ID`),
        client_secret: env(`${prefix}_CLIENT_SECRET`),
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    }),
    "Renouvellement du jeton Google",
  );
  return {
    accessToken: String(payload.access_token ?? ""),
    expiresAt: new Date(Date.now() + Number(payload.expires_in ?? 3600) * 1000).toISOString(),
  };
}

async function publishFacebook(input: PublishInput): Promise<PublishResult> {
  const image = input.mediaUrls[0] ?? null;
  if (image) {
    const payload = await readJson(
      await fetch(`https://graph.facebook.com/${META_VERSION}/${input.externalAccountId}/photos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: image, caption: input.body, access_token: input.accessToken }),
      }),
      "Publication Facebook",
    );
    const postId = String(payload.post_id ?? payload.id ?? "");
    return { postId, url: postId ? `https://www.facebook.com/${postId}` : null };
  }

  const payload = await readJson(
    await fetch(`https://graph.facebook.com/${META_VERSION}/${input.externalAccountId}/feed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: input.body, link: input.linkUrl || undefined, access_token: input.accessToken }),
    }),
    "Publication Facebook",
  );
  const postId = String(payload.id ?? "");
  return { postId, url: postId ? `https://www.facebook.com/${postId}` : null };
}

async function publishInstagram(input: PublishInput): Promise<PublishResult> {
  const image = input.mediaUrls[0];
  // Instagram refuse une publication sans média : mieux vaut le dire ici que
  // laisser le réseau renvoyer une erreur illisible.
  if (!image) throw new Error("Instagram exige une photo ou une vidéo : ajoute un média à la publication.");

  const container = await readJson(
    await fetch(`https://graph.facebook.com/${META_VERSION}/${input.externalAccountId}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image_url: image, caption: input.body, access_token: input.accessToken }),
    }),
    "Préparation du média Instagram",
  );
  const creationId = String(container.id ?? "");
  if (!creationId) throw new Error("Instagram n'a pas renvoyé de conteneur de média.");

  const published = await readJson(
    await fetch(`https://graph.facebook.com/${META_VERSION}/${input.externalAccountId}/media_publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creation_id: creationId, access_token: input.accessToken }),
    }),
    "Publication Instagram",
  );
  const postId = String(published.id ?? "");
  return { postId, url: null };
}

async function publishLinkedin(input: PublishInput): Promise<PublishResult> {
  const response = await fetch("https://api.linkedin.com/rest/posts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      "Content-Type": "application/json",
      "LinkedIn-Version": "202409",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify({
      author: input.externalAccountId,
      commentary: input.body,
      visibility: "PUBLIC",
      distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
      ...(input.linkUrl ? { content: { article: { source: input.linkUrl, title: input.body.slice(0, 90) || "Publication" } } } : {}),
    }),
  });
  if (!response.ok) await readJson(response, "Publication LinkedIn");
  const postId = response.headers.get("x-restli-id") ?? response.headers.get("x-linkedin-id") ?? "";
  return { postId, url: postId ? `https://www.linkedin.com/feed/update/${postId}` : null };
}

async function publishGoogleBusiness(input: PublishInput): Promise<PublishResult> {
  if (!input.parentAccountId) throw new Error("Établissement Google incomplet : reconnecte le compte.");
  const name = `${input.parentAccountId}/${input.externalAccountId.replace(/^.*?(locations\/)/, "$1")}`;
  const payload = await readJson(
    await fetch(`https://mybusiness.googleapis.com/v4/${name}/localPosts`, {
      method: "POST",
      headers: { Authorization: `Bearer ${input.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        languageCode: "fr",
        summary: input.body,
        topicType: "STANDARD",
        ...(input.linkUrl ? { callToAction: { actionType: "LEARN_MORE", url: input.linkUrl } } : {}),
        ...(input.mediaUrls.length ? { media: input.mediaUrls.slice(0, 1).map((url) => ({ mediaFormat: "PHOTO", sourceUrl: url })) } : {}),
      }),
    }),
    "Publication Google Business",
  );
  return { postId: String(payload.name ?? ""), url: String(payload.searchUrl ?? "") || null };
}

const TIKTOK_MAX_BYTES = 64 * 1024 * 1024;

/**
 * TikTok recoit le fichier lui-meme, pas son adresse.
 *
 * L'autre voie, PULL_FROM_URL, impose de prouver a TikTok qu'on possede le
 * domaine qui heberge la video. Nos medias vivent sur un domaine Supabase :
 * cette preuve est impossible. On televerse donc les octets.
 */
async function publishTiktok(input: PublishInput): Promise<PublishResult> {
  const source = input.videoUrls[0];
  if (!source) throw new Error("TikTok exige une vidéo : ajoute un fichier vidéo à la publication.");

  const download = await fetch(source);
  if (!download.ok) throw new Error("Vidéo illisible depuis la médiathèque.");
  const bytes = new Uint8Array(await download.arrayBuffer());
  if (!bytes.length) throw new Error("Vidéo vide.");
  if (bytes.length > TIKTOK_MAX_BYTES) throw new Error("Vidéo trop lourde pour TikTok : 64 Mo maximum.");

  const init = await readJson(
    await fetch("https://open.tiktokapis.com/v2/post/publish/video/init/", {
      method: "POST",
      headers: { Authorization: `Bearer ${input.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        post_info: {
          title: input.body.slice(0, 2200),
          // Une application non auditee par TikTok ne peut publier qu'en prive :
          // le secret permet de rester conforme sans changer le code.
          privacy_level: Deno.env.get("TIKTOK_PRIVACY_LEVEL")?.trim() || "PUBLIC_TO_EVERYONE",
          disable_comment: false,
        },
        source_info: {
          source: "FILE_UPLOAD",
          video_size: bytes.length,
          chunk_size: bytes.length,
          total_chunk_count: 1,
        },
      }),
    }),
    "Préparation de la publication TikTok",
  );

  const publishId = String(init?.data?.publish_id ?? "");
  const uploadUrl = String(init?.data?.upload_url ?? "");
  if (!publishId || !uploadUrl) throw new Error("TikTok n'a pas renvoyé d'adresse de téléversement.");

  const upload = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(bytes.length),
      "Content-Range": `bytes 0-${bytes.length - 1}/${bytes.length}`,
    },
    body: bytes,
  });
  if (!upload.ok) throw new Error(`Téléversement TikTok refusé : ${upload.status}`);

  // TikTok finit le traitement de son côté : la publication n'est pas encore
  // visible, seul son identifiant de traitement existe à cet instant.
  return { postId: publishId, url: null };
}

const YOUTUBE_MAX_BYTES = 128 * 1024 * 1024;

/**
 * YouTube recoit la video en deux temps : une session d'envoi, puis les octets.
 *
 * Le titre et la description sont deux champs distincts, ce qu'aucun autre
 * reseau ne demande : le titre interne de la publication sert de titre, le
 * texte valide sert de description.
 */
async function publishYoutube(input: PublishInput): Promise<PublishResult> {
  const source = input.videoUrls[0];
  if (!source) throw new Error("YouTube exige une vidéo : ajoute un fichier vidéo à la publication.");

  const download = await fetch(source);
  if (!download.ok) throw new Error("Vidéo illisible depuis la médiathèque.");
  const bytes = new Uint8Array(await download.arrayBuffer());
  if (!bytes.length) throw new Error("Vidéo vide.");
  if (bytes.length > YOUTUBE_MAX_BYTES) throw new Error("Vidéo trop lourde pour cet envoi : 128 Mo maximum.");

  const metadata = {
    snippet: {
      title: (input.title || input.body).slice(0, 100) || "Publication",
      description: input.body.slice(0, 5000),
      categoryId: "26",
    },
    status: {
      privacyStatus: Deno.env.get("YOUTUBE_PRIVACY_STATUS")?.trim() || "public",
      selfDeclaredMadeForKids: false,
    },
  };

  const session = await fetch(
    "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Length": String(bytes.length),
        "X-Upload-Content-Type": "video/*",
      },
      body: JSON.stringify(metadata),
    },
  );
  if (!session.ok) await readJson(session, "Préparation de l'envoi YouTube");
  const uploadUrl = session.headers.get("location") ?? session.headers.get("Location") ?? "";
  if (!uploadUrl) throw new Error("YouTube n'a pas renvoyé d'adresse d'envoi.");

  const upload = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "video/*", "Content-Length": String(bytes.length) },
    body: bytes,
  });
  const payload = await readJson(upload, "Envoi de la vidéo YouTube");
  const videoId = String(payload.id ?? "");
  if (!videoId) throw new Error("YouTube n'a pas renvoyé d'identifiant de vidéo.");
  return { postId: videoId, url: `https://www.youtube.com/watch?v=${videoId}` };
}

export async function publishToNetwork(input: PublishInput): Promise<PublishResult> {
  if (!input.body.trim()) throw new Error("Le texte de la publication est vide.");
  switch (input.provider) {
    case "facebook": return publishFacebook(input);
    case "instagram": return publishInstagram(input);
    case "linkedin": return publishLinkedin(input);
    case "google_business": return publishGoogleBusiness(input);
    case "tiktok": return publishTiktok(input);
    case "youtube": return publishYoutube(input);
    default: throw new Error(`Diffusion non prise en charge pour ${input.provider}.`);
  }
}
