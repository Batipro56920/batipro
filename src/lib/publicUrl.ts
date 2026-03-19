export function getPublicAppUrl(): string {
  const configuredUrl = normalizePublicUrl(import.meta.env.VITE_PUBLIC_APP_URL ?? "");

  if (import.meta.env.DEV) {
    console.log("[ENV CHECK] VITE_PUBLIC_APP_URL =", configuredUrl || "<empty>");
  }

  if (configuredUrl) return configuredUrl;

  const runtimeUrl = getRuntimePublicAppUrl();
  if (runtimeUrl) return runtimeUrl;

  return "";
}

export function buildIntervenantLink(token: string): string {
  const path = `/intervenant?token=${encodeURIComponent(token)}`;
  const base = getPublicAppUrl();

  if (base) return `${base}${path}`;

  if (typeof window !== "undefined" && window.location?.href) {
    return new URL(path, window.location.href).toString();
  }

  return path;
}

function normalizePublicUrl(value: string): string | null {
  const normalizedRaw = String(value ?? "").replace(/^['\"]|['\"]$/g, "").trim();
  if (!normalizedRaw || !normalizedRaw.startsWith("http")) return null;

  try {
    const parsed = new URL(normalizedRaw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;

    const normalized = `${parsed.origin}${parsed.pathname === "/" ? "" : parsed.pathname}`.replace(/\/$/, "");
    if (normalized.includes("<") || normalized.includes(">")) return null;

    return normalized;
  } catch {
    return null;
  }
}

function getRuntimePublicAppUrl(): string | null {
  if (typeof window !== "undefined" && window.location?.origin) {
    const runtimeOrigin = normalizePublicUrl(window.location.origin);
    if (runtimeOrigin) return runtimeOrigin;
  }

  if (typeof document !== "undefined") {
    const runtimeBase = normalizePublicUrl(document.baseURI ?? document.URL ?? "");
    if (runtimeBase) return runtimeBase;
  }

  return null;
}
