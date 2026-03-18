export function getPublicAppUrl(): string {
  const configuredUrl = normalizePublicUrl(import.meta.env.VITE_PUBLIC_APP_URL ?? "");

  if (import.meta.env.DEV) {
    console.log("[ENV CHECK] VITE_PUBLIC_APP_URL =", configuredUrl || "<empty>");
  }

  if (configuredUrl) return configuredUrl;

  if (typeof window !== "undefined") {
    const runtimeOrigin = normalizePublicUrl(window.location.origin);
    if (runtimeOrigin) return runtimeOrigin;
  }

  throw new Error(
    "VITE_PUBLIC_APP_URL manquant. Définir sur Vercel (Production) et dans .env.local (Local).",
  );
}

export function buildIntervenantLink(token: string): string {
  const base = getPublicAppUrl();
  return `${base}/intervenant?token=${encodeURIComponent(token)}`;
}

function normalizePublicUrl(value: string): string | null {
  const normalizedRaw = String(value ?? "").replace(/^['\"]|['\"]$/g, "").trim();
  if (!normalizedRaw || !normalizedRaw.startsWith("http")) return null;

  const normalized = normalizedRaw.replace(/\/$/, "");
  if (normalized.includes("<") || normalized.includes(">")) return null;

  return normalized;
}
