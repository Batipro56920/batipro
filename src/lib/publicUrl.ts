export function getPublicAppUrl(): string {
  const raw = import.meta.env.VITE_PUBLIC_APP_URL;

  if (!raw || !String(raw).startsWith("http")) {
    throw new Error(
      "VITE_PUBLIC_APP_URL manquant. Définir sur Vercel (Production) et dans .env.local (Local).",
    );
  }

  return String(raw).replace(/\/$/, "");
}

export function buildIntervenantLink(token: string): string {
  const base = getPublicAppUrl();
  return `${base}/intervenant?token=${encodeURIComponent(token)}`;
}
