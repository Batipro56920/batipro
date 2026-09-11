import type { SocialNetwork } from "./types";

/**
 * Un seul vocabulaire pour les réseaux.
 *
 * Le kanban enregistrait des libellés ("Facebook", "Google") pendant que le
 * compositeur enregistrait des identifiants ("facebook", "google_business").
 * Le calendrier, qui colore et filtre sur la valeur stockée, voyait donc deux
 * réseaux là où il n'y en a qu'un. Tout passe désormais par les identifiants,
 * et l'affichage traduit au dernier moment.
 */
export type ChannelId = SocialNetwork | "site_web";

export type ChannelDefinition = {
  id: ChannelId;
  label: string;
  /** Pastille de couleur dans le compositeur. */
  dot: string;
  /** Carte du calendrier éditorial. */
  calendar: string;
  /** Limite de caractères imposée par le réseau, 0 si sans objet. */
  limit: number;
  hint: string;
  /** Un réseau sur lequel on publie réellement, par opposition au site web. */
  publishable: boolean;
};

export const CHANNELS: ChannelDefinition[] = [
  { id: "facebook", label: "Facebook", dot: "bg-blue-600", calendar: "border-blue-300 bg-blue-50 text-blue-950", limit: 63206, hint: "Texte clair, lien et appel à l’action", publishable: true },
  { id: "instagram", label: "Instagram", dot: "bg-pink-600", calendar: "border-pink-300 bg-pink-50 text-pink-950", limit: 2200, hint: "Accroche visuelle et hashtags ciblés", publishable: true },
  { id: "linkedin", label: "LinkedIn", dot: "bg-sky-700", calendar: "border-sky-300 bg-sky-50 text-sky-950", limit: 3000, hint: "Expertise, méthode et résultat métier", publishable: true },
  { id: "google_business", label: "Google Business", dot: "bg-amber-500", calendar: "border-amber-300 bg-amber-50 text-amber-950", limit: 1500, hint: "Actualité locale et bénéfice client", publishable: true },
  { id: "tiktok", label: "TikTok", dot: "bg-slate-900", calendar: "border-slate-300 bg-slate-50 text-slate-950", limit: 2200, hint: "Vidéo verticale obligatoire, 64 Mo maximum", publishable: true },
  { id: "youtube", label: "YouTube", dot: "bg-red-600", calendar: "border-red-300 bg-red-50 text-red-950", limit: 5000, hint: "Vidéo obligatoire, le titre interne devient le titre", publishable: true },
  { id: "site_web", label: "Site web", dot: "bg-emerald-600", calendar: "border-emerald-300 bg-emerald-50 text-emerald-950", limit: 0, hint: "Page réalisation ou article de blog", publishable: false },
];

/** Réseaux proposés dans le compositeur, dans l'ordre d'usage. */
export const COMPOSER_NETWORKS = CHANNELS.filter(
  (channel): channel is ChannelDefinition & { id: SocialNetwork } =>
    channel.publishable && ["facebook", "instagram", "linkedin", "google_business", "tiktok", "youtube"].includes(channel.id),
);

const BY_ID = new Map<string, ChannelDefinition>(CHANNELS.map((channel) => [channel.id, channel]));

/**
 * Ramène une valeur de canal à son identifiant, quel que soit son âge.
 * Les campagnes créées avant l'unification portent encore des libellés.
 */
export function normalizeChannel(value: string): ChannelId | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (BY_ID.has(raw)) return raw as ChannelId;
  const key = raw
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (BY_ID.has(key)) return key as ChannelId;
  const legacy: Record<string, ChannelId> = {
    google: "google_business",
    google_business_profile: "google_business",
    site: "site_web",
    siteweb: "site_web",
    web: "site_web",
    fb: "facebook",
    insta: "instagram",
  };
  return legacy[key] ?? null;
}

export function normalizeChannels(values: string[] | null | undefined): ChannelId[] {
  const seen = new Set<ChannelId>();
  for (const value of values ?? []) {
    const id = normalizeChannel(value);
    if (id) seen.add(id);
  }
  return Array.from(seen);
}

export function channelLabel(value: string): string {
  const id = normalizeChannel(value);
  return id ? BY_ID.get(id)?.label ?? id : value;
}

export function channelDefinition(value: string): ChannelDefinition | null {
  const id = normalizeChannel(value);
  return id ? BY_ID.get(id) ?? null : null;
}

/** Limite de caractères d'un réseau, ou null quand il n'en impose pas. */
export function channelLimit(value: string): number | null {
  const definition = channelDefinition(value);
  return definition && definition.limit > 0 ? definition.limit : null;
}
