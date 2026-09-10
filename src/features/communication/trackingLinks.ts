import type { SocialNetwork } from "./types";

const NETWORK_SOURCES: Record<SocialNetwork, string> = {
  facebook: "facebook",
  instagram: "instagram",
  linkedin: "linkedin",
  google_business: "google_business_profile",
  tiktok: "tiktok",
  youtube: "youtube",
};

export function slugifyTrackingValue(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function buildTrackedUrl(input: {
  destinationUrl: string;
  network: SocialNetwork;
  campaignName: string;
  contentName: string;
}) {
  const rawUrl = input.destinationUrl.trim();
  if (!rawUrl) return "";

  try {
    const url = new URL(rawUrl);
    url.searchParams.set("utm_source", NETWORK_SOURCES[input.network]);
    url.searchParams.set("utm_medium", "social");
    url.searchParams.set("utm_campaign", slugifyTrackingValue(input.campaignName) || "campagne");
    url.searchParams.set("utm_content", slugifyTrackingValue(input.contentName) || "publication");
    return url.toString();
  } catch {
    return "";
  }
}
