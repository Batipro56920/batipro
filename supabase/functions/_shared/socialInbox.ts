/**
 * Lecture et reponse des conversations sociales.
 *
 * Messages prives, commentaires et avis n'ont rien en commun chez les reseaux :
 * ce module les ramene tous a un fil, avec ses messages et de quoi y repondre.
 * Ce que le reseau exige pour la reponse est conserve dans metadata, sinon il
 * faudrait refaire un aller-retour a chaque fois.
 */

const META_VERSION = "v21.0";

export type InboxKind = "message" | "comment" | "mention" | "review";

export type NormalizedMessage = {
  providerMessageId: string;
  providerParentId: string | null;
  direction: "inbound" | "outbound";
  body: string;
  authorName: string | null;
  sentAt: string;
};

export type NormalizedThread = {
  providerThreadId: string;
  kind: InboxKind;
  contactName: string | null;
  contactAvatarUrl: string | null;
  subject: string | null;
  permalink: string | null;
  lastMessageAt: string;
  /** Ce dont la reponse aura besoin : destinataire, commentaire, avis. */
  metadata: Record<string, unknown>;
  messages: NormalizedMessage[];
};

async function readJson(response: Response, context: string) {
  const text = await response.text();
  let payload: any = null;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = null; }
  if (!response.ok) {
    const message = payload?.error?.message ?? payload?.error_description ?? payload?.message ?? text.slice(0, 300);
    throw new Error(`${context} : ${message || response.status}`);
  }
  return payload ?? {};
}

function isoOr(value: unknown): string {
  const parsed = Date.parse(String(value ?? ""));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
}

async function facebookConversations(pageId: string, token: string, platform: "messenger" | "instagram"): Promise<NormalizedThread[]> {
  const params = new URLSearchParams({
    access_token: token,
    platform,
    fields: "id,updated_time,participants,messages.limit(20){id,message,from,created_time}",
    limit: "25",
  });
  const payload = await readJson(
    await fetch(`https://graph.facebook.com/${META_VERSION}/${pageId}/conversations?${params.toString()}`),
    "Lecture des conversations",
  );
  const threads: NormalizedThread[] = [];
  for (const conversation of Array.isArray(payload.data) ? payload.data : []) {
    const participants = Array.isArray(conversation?.participants?.data) ? conversation.participants.data : [];
    const contact = participants.find((participant: any) => String(participant?.id) !== pageId) ?? participants[0] ?? {};
    const messages = Array.isArray(conversation?.messages?.data) ? conversation.messages.data : [];
    threads.push({
      providerThreadId: String(conversation.id),
      kind: "message",
      contactName: contact.name ? String(contact.name) : null,
      contactAvatarUrl: null,
      subject: messages.length ? String(messages[0].message ?? "").slice(0, 160) : null,
      permalink: null,
      lastMessageAt: isoOr(conversation.updated_time),
      metadata: { recipientId: contact.id ? String(contact.id) : null, pageId, platform },
      messages: messages.map((message: any) => ({
        providerMessageId: String(message.id),
        providerParentId: null,
        direction: String(message?.from?.id ?? "") === pageId ? "outbound" : "inbound",
        body: String(message.message ?? ""),
        authorName: message?.from?.name ? String(message.from.name) : null,
        sentAt: isoOr(message.created_time),
      })),
    });
  }
  return threads;
}

async function facebookComments(pageId: string, token: string): Promise<NormalizedThread[]> {
  const params = new URLSearchParams({
    access_token: token,
    fields: "id,permalink_url,message,comments.limit(25){id,message,from,created_time}",
    limit: "25",
  });
  const payload = await readJson(
    await fetch(`https://graph.facebook.com/${META_VERSION}/${pageId}/feed?${params.toString()}`),
    "Lecture des commentaires Facebook",
  );
  const threads: NormalizedThread[] = [];
  for (const post of Array.isArray(payload.data) ? payload.data : []) {
    const comments = Array.isArray(post?.comments?.data) ? post.comments.data : [];
    for (const comment of comments) {
      if (String(comment?.from?.id ?? "") === pageId) continue;
      threads.push({
        providerThreadId: String(comment.id),
        kind: "comment",
        contactName: comment?.from?.name ? String(comment.from.name) : null,
        contactAvatarUrl: null,
        subject: String(post.message ?? "").slice(0, 160) || null,
        permalink: post.permalink_url ? String(post.permalink_url) : null,
        lastMessageAt: isoOr(comment.created_time),
        metadata: { commentId: String(comment.id), postId: String(post.id) },
        messages: [{
          providerMessageId: String(comment.id),
          providerParentId: String(post.id),
          direction: "inbound",
          body: String(comment.message ?? ""),
          authorName: comment?.from?.name ? String(comment.from.name) : null,
          sentAt: isoOr(comment.created_time),
        }],
      });
    }
  }
  return threads;
}

async function instagramComments(igId: string, token: string): Promise<NormalizedThread[]> {
  const params = new URLSearchParams({
    access_token: token,
    fields: "id,permalink,caption,comments.limit(25){id,text,username,timestamp}",
    limit: "25",
  });
  const payload = await readJson(
    await fetch(`https://graph.facebook.com/${META_VERSION}/${igId}/media?${params.toString()}`),
    "Lecture des commentaires Instagram",
  );
  const threads: NormalizedThread[] = [];
  for (const media of Array.isArray(payload.data) ? payload.data : []) {
    for (const comment of Array.isArray(media?.comments?.data) ? media.comments.data : []) {
      threads.push({
        providerThreadId: String(comment.id),
        kind: "comment",
        contactName: comment.username ? String(comment.username) : null,
        contactAvatarUrl: null,
        subject: String(media.caption ?? "").slice(0, 160) || null,
        permalink: media.permalink ? String(media.permalink) : null,
        lastMessageAt: isoOr(comment.timestamp),
        metadata: { commentId: String(comment.id), mediaId: String(media.id) },
        messages: [{
          providerMessageId: String(comment.id),
          providerParentId: String(media.id),
          direction: "inbound",
          body: String(comment.text ?? ""),
          authorName: comment.username ? String(comment.username) : null,
          sentAt: isoOr(comment.timestamp),
        }],
      });
    }
  }
  return threads;
}

async function googleReviews(locationPath: string, token: string): Promise<NormalizedThread[]> {
  const payload = await readJson(
    await fetch(`https://mybusiness.googleapis.com/v4/${locationPath}/reviews?pageSize=50`, {
      headers: { Authorization: `Bearer ${token}` },
    }),
    "Lecture des avis Google",
  );
  const threads: NormalizedThread[] = [];
  for (const review of Array.isArray(payload.reviews) ? payload.reviews : []) {
    const name = String(review.name ?? "");
    if (!name) continue;
    const messages: NormalizedMessage[] = [{
      providerMessageId: name,
      providerParentId: null,
      direction: "inbound",
      body: String(review.comment ?? ""),
      authorName: review?.reviewer?.displayName ? String(review.reviewer.displayName) : null,
      sentAt: isoOr(review.createTime),
    }];
    if (review.reviewReply?.comment) {
      messages.push({
        providerMessageId: `${name}:reply`,
        providerParentId: name,
        direction: "outbound",
        body: String(review.reviewReply.comment),
        authorName: null,
        sentAt: isoOr(review.reviewReply.updateTime),
      });
    }
    threads.push({
      providerThreadId: name,
      kind: "review",
      contactName: review?.reviewer?.displayName ? String(review.reviewer.displayName) : null,
      contactAvatarUrl: review?.reviewer?.profilePhotoUrl ? String(review.reviewer.profilePhotoUrl) : null,
      subject: `Avis ${String(review.starRating ?? "")}`.trim(),
      permalink: null,
      lastMessageAt: isoOr(review.updateTime ?? review.createTime),
      metadata: { reviewName: name },
      messages,
    });
  }
  return threads;
}

/**
 * LinkedIn n'a pas de boite de reception : les commentaires ne se lisent que
 * publication par publication. On parcourt donc ce que Batipro a publie.
 */
async function linkedinComments(organizationUrn: string, postUrns: string[], token: string): Promise<NormalizedThread[]> {
  const threads: NormalizedThread[] = [];
  for (const shareUrn of postUrns.slice(0, 25)) {
    const payload = await readJson(
      await fetch(`https://api.linkedin.com/rest/socialActions/${encodeURIComponent(shareUrn)}/comments?count=50`, {
        headers: { Authorization: `Bearer ${token}`, "LinkedIn-Version": "202409", "X-Restli-Protocol-Version": "2.0.0" },
      }),
      "Lecture des commentaires LinkedIn",
    );
    for (const comment of Array.isArray(payload.elements) ? payload.elements : []) {
      const actor = String(comment.actor ?? "");
      if (actor === organizationUrn) continue;
      const commentUrn = String(comment["$URN"] ?? comment.id ?? "");
      if (!commentUrn) continue;
      threads.push({
        providerThreadId: commentUrn,
        kind: "comment",
        // LinkedIn ne donne pas le nom de l'auteur sans autorisation supplementaire.
        contactName: actor.startsWith("urn:li:organization") ? "Page LinkedIn" : "Membre LinkedIn",
        contactAvatarUrl: null,
        subject: null,
        permalink: `https://www.linkedin.com/feed/update/${shareUrn}`,
        lastMessageAt: isoOr(comment?.created?.time ? new Date(Number(comment.created.time)).toISOString() : null),
        metadata: { commentUrn, shareUrn, organizationUrn },
        messages: [{
          providerMessageId: commentUrn,
          providerParentId: shareUrn,
          direction: "inbound",
          body: String(comment?.message?.text ?? ""),
          authorName: null,
          sentAt: isoOr(comment?.created?.time ? new Date(Number(comment.created.time)).toISOString() : null),
        }],
      });
    }
  }
  return threads;
}

export async function fetchThreads(input: {
  provider: string;
  externalAccountId: string;
  parentAccountId: string | null;
  accessToken: string;
  publishedPostIds?: string[];
}): Promise<NormalizedThread[]> {
  switch (input.provider) {
    case "facebook": {
      const [conversations, comments] = await Promise.all([
        facebookConversations(input.externalAccountId, input.accessToken, "messenger"),
        facebookComments(input.externalAccountId, input.accessToken),
      ]);
      return [...conversations, ...comments];
    }
    case "instagram": {
      const comments = await instagramComments(input.externalAccountId, input.accessToken);
      if (!input.parentAccountId) return comments;
      const conversations = await facebookConversations(input.parentAccountId, input.accessToken, "instagram");
      return [...conversations, ...comments];
    }
    case "google_business": {
      if (!input.parentAccountId) throw new Error("Établissement Google incomplet : reconnecte le compte.");
      const location = input.externalAccountId.replace(/^.*?(locations\/)/, "$1");
      return googleReviews(`${input.parentAccountId}/${location}`, input.accessToken);
    }
    case "linkedin":
      return linkedinComments(input.externalAccountId, input.publishedPostIds ?? [], input.accessToken);
    // TikTok ne donne acces aux commentaires qu'aux partenaires valides :
    // l'API publique ne les expose pas.
    default:
      return [];
  }
}

export async function replyToThread(input: {
  provider: string;
  kind: InboxKind;
  metadata: Record<string, unknown>;
  accessToken: string;
  body: string;
}): Promise<{ providerMessageId: string }> {
  const text = input.body.trim();
  if (!text) throw new Error("La réponse est vide.");

  if (input.provider === "google_business") {
    const reviewName = String(input.metadata?.reviewName ?? "");
    if (!reviewName) throw new Error("Avis introuvable : relance une synchronisation.");
    await readJson(
      await fetch(`https://mybusiness.googleapis.com/v4/${reviewName}/reply`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${input.accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ comment: text }),
      }),
      "Réponse à l'avis Google",
    );
    return { providerMessageId: `${reviewName}:reply` };
  }

  if (input.provider === "linkedin") {
    const shareUrn = String(input.metadata?.shareUrn ?? "");
    const commentUrn = String(input.metadata?.commentUrn ?? "");
    const organizationUrn = String(input.metadata?.organizationUrn ?? "");
    if (!shareUrn || !organizationUrn) throw new Error("Publication LinkedIn introuvable : relance une synchronisation.");
    const response = await fetch(`https://api.linkedin.com/rest/socialActions/${encodeURIComponent(shareUrn)}/comments`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        "Content-Type": "application/json",
        "LinkedIn-Version": "202409",
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify({
        actor: organizationUrn,
        object: shareUrn,
        message: { text },
        ...(commentUrn ? { parentComment: commentUrn } : {}),
      }),
    });
    if (!response.ok) await readJson(response, "Réponse au commentaire LinkedIn");
    const payload = await response.json().catch(() => ({}));
    return { providerMessageId: String(payload?.["$URN"] ?? payload?.id ?? response.headers.get("x-restli-id") ?? "") };
  }

  if (input.kind === "comment") {
    const commentId = String(input.metadata?.commentId ?? "");
    if (!commentId) throw new Error("Commentaire introuvable : relance une synchronisation.");
    const path = input.provider === "instagram" ? "replies" : "comments";
    const payload = await readJson(
      await fetch(`https://graph.facebook.com/${META_VERSION}/${commentId}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, access_token: input.accessToken }),
      }),
      "Réponse au commentaire",
    );
    return { providerMessageId: String(payload.id ?? "") };
  }

  const recipientId = String(input.metadata?.recipientId ?? "");
  const pageId = String(input.metadata?.pageId ?? "");
  if (!recipientId || !pageId) throw new Error("Destinataire introuvable : relance une synchronisation.");
  const payload = await readJson(
    await fetch(`https://graph.facebook.com/${META_VERSION}/${pageId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: { text },
        messaging_type: "RESPONSE",
        access_token: input.accessToken,
      }),
    }),
    "Envoi du message",
  );
  return { providerMessageId: String(payload.message_id ?? payload.id ?? "") };
}
