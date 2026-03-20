import { supabase } from "../lib/supabaseClient";
import { buildIntervenantLink } from "../lib/publicUrl";

export type SendIntervenantAccessInput = {
  chantierId: string;
  intervenantId?: string;
  email?: string;
  nom?: string;
  role?: "intervenant" | "client";
  expiresInDays?: number;
};

export type SendIntervenantAccessResult = {
  token: string;
  accessUrl: string;
  chantierId?: string;
  expiresAt?: string;
};

function extractIntervenantToken(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  if (raw.includes("token=")) {
    try {
      const parsed = new URL(raw);
      const tokenFromQuery = parsed.searchParams.get("token")?.trim();
      if (tokenFromQuery) return tokenFromQuery;
    } catch {
      // noop
    }
    const tokenPart = raw.split("token=")[1] ?? "";
    const sanitized = tokenPart.split("&")[0]?.trim();
    if (sanitized) return decodeURIComponent(sanitized);
  }

  if (/^https?:\/\//i.test(raw)) return null;
  return raw;
}

function resolveTokenFromRpc(data: unknown): string | null {
  if (typeof data === "string") return extractIntervenantToken(data);
  if (Array.isArray(data)) {
    if (!data.length) return null;
    return resolveTokenFromRpc(data[0]);
  }
  if (data && typeof data === "object") {
    const row = data as Record<string, unknown>;
    return (
      extractIntervenantToken(row.token) ||
      extractIntervenantToken(row.access_token) ||
      extractIntervenantToken(row.admin_create_intervenant_link) ||
      extractIntervenantToken(row.access_url ?? row.url ?? row.link)
    );
  }
  return null;
}

async function ensureAuthenticatedSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!data.session) throw new Error("Pas connecte. Reconnecte-toi puis reessaie.");
}

export async function sendIntervenantAccess(
  input: SendIntervenantAccessInput,
): Promise<SendIntervenantAccessResult> {
  await ensureAuthenticatedSession();

  const expiresAt = new Date(
    Date.now() + Math.max(1, Number(input.expiresInDays ?? 30)) * 24 * 60 * 60 * 1000,
  ).toISOString();

  let { data, error } = await (supabase as any).rpc("admin_create_intervenant_link", {
    p_chantier_id: input.chantierId,
    p_intervenant_id: input.intervenantId ?? null,
    p_expires_at: expiresAt,
  });

  if (error) {
    const msg = String((error as { message?: string })?.message ?? "").toLowerCase();
    const supportsLegacy =
      msg.includes("p_intervenant_id") || msg.includes("signature") || msg.includes("does not exist");

    if (supportsLegacy) {
      if (input.intervenantId) {
        throw new Error("La fonction de génération de lien intervenant doit être mise à jour pour cibler un intervenant précis.");
      }
      const fallback = await (supabase as any).rpc("admin_create_intervenant_link", {
        p_chantier_id: input.chantierId,
        p_expires_at: expiresAt,
      });
      data = fallback.data;
      error = fallback.error;
    }
  }

  if (error) throw error;

  const token = resolveTokenFromRpc(data);
  if (!token) throw new Error("Token intervenant introuvable dans la reponse RPC.");

  const accessUrl = buildIntervenantLink(token);
  if (import.meta.env.DEV) {
    console.log("Generated intervenant link:", accessUrl);
  }

  return {
    token,
    accessUrl,
    chantierId: input.chantierId,
    expiresAt,
  };
}
