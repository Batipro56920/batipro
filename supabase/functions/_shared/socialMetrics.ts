/**
 * Mesures d'une publication diffusee.
 *
 * Chaque reseau nomme ses compteurs autrement et n'expose pas les memes. Ce
 * module ramene ce qui existe et laisse a zero ce qui n'existe pas, plutot que
 * d'inventer une equivalence : un chiffre absent doit rester absent.
 */

const META_VERSION = "v21.0";

export type PostMetrics = {
  impressions: number;
  reach: number;
  engagements: number;
  clicks: number;
  comments: number;
  shares: number;
};

export const EMPTY_METRICS: PostMetrics = { impressions: 0, reach: 0, engagements: 0, clicks: 0, comments: 0, shares: 0 };

async function readJson(response: Response, context: string) {
  const text = await response.text();
  let payload: any = null;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = null; }
  if (!response.ok) {
    const message = payload?.error?.message ?? payload?.message ?? text.slice(0, 300);
    throw new Error(`${context} : ${message || response.status}`);
  }
  return payload ?? {};
}

function metaInsightValues(payload: any): Record<string, number> {
  const values: Record<string, number> = {};
  for (const entry of Array.isArray(payload?.data) ? payload.data : []) {
    const name = String(entry?.name ?? "");
    const value = Number(entry?.values?.[0]?.value ?? 0);
    if (name) values[name] = Number.isFinite(value) ? value : 0;
  }
  return values;
}

async function facebookMetrics(postId: string, token: string): Promise<PostMetrics> {
  const insightParams = new URLSearchParams({
    access_token: token,
    metric: "post_impressions,post_impressions_unique,post_engaged_users,post_clicks",
  });
  const [insights, post] = await Promise.all([
    readJson(await fetch(`https://graph.facebook.com/${META_VERSION}/${postId}/insights?${insightParams.toString()}`), "Statistiques Facebook"),
    readJson(
      await fetch(`https://graph.facebook.com/${META_VERSION}/${postId}?fields=shares,comments.summary(true)&access_token=${encodeURIComponent(token)}`),
      "Publication Facebook",
    ),
  ]);
  const values = metaInsightValues(insights);
  return {
    impressions: values.post_impressions ?? 0,
    reach: values.post_impressions_unique ?? 0,
    engagements: values.post_engaged_users ?? 0,
    clicks: values.post_clicks ?? 0,
    comments: Number(post?.comments?.summary?.total_count ?? 0),
    shares: Number(post?.shares?.count ?? 0),
  };
}

async function instagramMetrics(mediaId: string, token: string): Promise<PostMetrics> {
  const params = new URLSearchParams({ access_token: token, metric: "reach,likes,comments,shares,saved" });
  const payload = await readJson(
    await fetch(`https://graph.facebook.com/${META_VERSION}/${mediaId}/insights?${params.toString()}`),
    "Statistiques Instagram",
  );
  const values = metaInsightValues(payload);
  const likes = values.likes ?? 0;
  const comments = values.comments ?? 0;
  const shares = values.shares ?? 0;
  const saved = values.saved ?? 0;
  return {
    // Instagram ne publie plus d'impressions par media : la portee fait foi.
    impressions: 0,
    reach: values.reach ?? 0,
    engagements: likes + comments + shares + saved,
    clicks: 0,
    comments,
    shares,
  };
}

/**
 * LinkedIn reserve les compteurs aux publications d'organisation.
 *
 * Batipro publie au nom du compte connecte, faute de page entreprise : aucun
 * chiffre n'est accessible, et il vaut mieux le dire que remonter des zeros.
 */
function linkedinMetrics(): Promise<PostMetrics> {
  return Promise.reject(
    new Error("LinkedIn ne fournit pas de statistiques pour une publication faite au nom d'un compte."),
  );
}

/**
 * TikTok ne mesure que des videos publiees.
 *
 * Ce que la diffusion a retenu est un identifiant de traitement : il faut
 * d'abord demander a TikTok ce qu'il est devenu, car la video peut encore etre
 * en cours d'encodage plusieurs minutes apres l'envoi.
 */
async function tiktokMetrics(publishId: string, token: string): Promise<PostMetrics> {
  const status = await readJson(
    await fetch("https://open.tiktokapis.com/v2/post/publish/status/fetch/", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ publish_id: publishId }),
    }),
    "Statut de la publication TikTok",
  );
  const postIds = status?.data?.publicaly_available_post_id ?? status?.data?.publicly_available_post_id ?? [];
  const videoId = Array.isArray(postIds) ? String(postIds[0] ?? "") : String(postIds ?? "");
  if (!videoId) throw new Error("Vidéo TikTok encore en traitement : mesure indisponible.");

  const payload = await readJson(
    await fetch("https://open.tiktokapis.com/v2/video/query/?fields=id,like_count,comment_count,share_count,view_count", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ filters: { video_ids: [videoId] } }),
    }),
    "Statistiques TikTok",
  );
  const video = (Array.isArray(payload?.data?.videos) ? payload.data.videos[0] : null) ?? {};
  const likes = Number(video.like_count ?? 0);
  const comments = Number(video.comment_count ?? 0);
  const shares = Number(video.share_count ?? 0);
  return {
    impressions: 0,
    reach: Number(video.view_count ?? 0),
    engagements: likes + comments + shares,
    clicks: 0,
    comments,
    shares,
  };
}

/**
 * YouTube publie des compteurs, pas des impressions.
 *
 * Les impressions existent dans l'API Analytics, qui demande une autorisation
 * supplementaire et un autre raisonnement : tant qu'on ne l'a pas, le nombre de
 * vues fait foi et les impressions restent absentes.
 */
async function youtubeMetrics(videoId: string, token: string): Promise<PostMetrics> {
  const payload = await readJson(
    await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${encodeURIComponent(videoId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    }),
    "Statistiques YouTube",
  );
  const stats = (Array.isArray(payload.items) ? payload.items[0]?.statistics : null) ?? {};
  const likes = Number(stats.likeCount ?? 0);
  const comments = Number(stats.commentCount ?? 0);
  return {
    impressions: 0,
    reach: Number(stats.viewCount ?? 0),
    engagements: likes + comments,
    clicks: 0,
    comments,
    shares: 0,
  };
}

export async function fetchPostMetrics(input: { provider: string; postId: string; accessToken: string }): Promise<PostMetrics> {
  switch (input.provider) {
    case "facebook": return facebookMetrics(input.postId, input.accessToken);
    case "instagram": return instagramMetrics(input.postId, input.accessToken);
    case "linkedin": return linkedinMetrics();
    case "tiktok": return tiktokMetrics(input.postId, input.accessToken);
    case "youtube": return youtubeMetrics(input.postId, input.accessToken);
    case "google_business":
      // Google ne publie pas de statistiques par publication locale : seules
      // les vues de la fiche entiere existent, ce qui n'est pas comparable.
      throw new Error("Google Business ne fournit pas de statistiques par publication.");
    default:
      throw new Error(`Statistiques non prises en charge pour ${input.provider}.`);
  }
}
