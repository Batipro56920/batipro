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
  externalAccountId: string;
  parentAccountId: string | null;
  accessToken: string;
  body: string;
  linkUrl: string | null;
  mediaUrls: string[];
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

/** Le jeton Google expire en une heure : il se renouvelle avant chaque envoi. */
export async function refreshGoogleToken(refreshToken: string) {
  const payload = await readJson(
    await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env("GOOGLE_BUSINESS_CLIENT_ID"),
        client_secret: env("GOOGLE_BUSINESS_CLIENT_SECRET"),
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

export async function publishToNetwork(input: PublishInput): Promise<PublishResult> {
  if (!input.body.trim()) throw new Error("Le texte de la publication est vide.");
  switch (input.provider) {
    case "facebook": return publishFacebook(input);
    case "instagram": return publishInstagram(input);
    case "linkedin": return publishLinkedin(input);
    case "google_business": return publishGoogleBusiness(input);
    default: throw new Error(`Diffusion non prise en charge pour ${input.provider}.`);
  }
}
