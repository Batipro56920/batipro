export function getPublicAppUrl(): string {
  const rawValue = String(import.meta.env.VITE_PUBLIC_APP_URL ?? "").trim();
  const normalizedRaw = rawValue.replace(/^['\"]|['\"]$/g, "").trim();

  if (import.meta.env.DEV) {
    console.log("[ENV CHECK] VITE_PUBLIC_APP_URL =", normalizedRaw || "<empty>");
  }

  if (!normalizedRaw || !normalizedRaw.startsWith("http")) {
    throw new Error(
      "VITE_PUBLIC_APP_URL manquant. Définir sur Vercel (Production) et dans .env.local (Local).",
    );
  }

  const normalized = normalizedRaw.replace(/\/$/, "");
  if (normalized.includes("<") || normalized.includes(">")) {
    throw new Error(
      "VITE_PUBLIC_APP_URL invalide. Remplace le placeholder par un vrai domaine Vercel.",
    );
  }

  return normalized;
}

export function buildIntervenantLink(token: string): string {
  const base = getPublicAppUrl();
  return `${base}/intervenant?token=${encodeURIComponent(token)}`;
}
